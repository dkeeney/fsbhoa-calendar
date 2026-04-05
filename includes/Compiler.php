<?php
namespace FSBHOA\Cal;

use RRule\RRule;
use DateTime;

class Compiler {

    /**
     * Main entry point: Orchestrates the bake process.
     */
    public function bake() {
        global $wpdb;
        $table = $wpdb->prefix . 'fsbhoa_events';
        $cat_table = $wpdb->prefix . 'fsbhoa_categories';
        $loc_table = $wpdb->prefix . 'fsbhoa_locations';

        // ---  Sync PHP with WordPress Timezone Settings ---
        $tz_string = get_option('timezone_string');
        if ($tz_string) {
            date_default_timezone_set($tz_string);
        } else {
            // Fallback for sites using Manual Offsets (e.g., UTC-7)
            $offset = get_option('gmt_offset');
            $tz_string = timezone_name_from_abbr('', $offset * 3600, false);
            if ($tz_string) date_default_timezone_set($tz_string);
        }

        // 1. Setup Environment & Range
        $past_months   = get_option('fsb_cal_past_months', 1);
        $future_months = get_option('fsb_cal_future_months', 12);

        $range_start = date('Y-m-01', strtotime("-{$past_months} months"));
        $range_end   = date('Y-m-t',  strtotime("+{$future_months} months"));

        $upload_dir   = wp_upload_dir();
        $output_path  = get_option('fsb_cal_json_path', $upload_dir['basedir'] . '/fsbhoa-calendar/calendar-events.json');

        // 2. Fetch Category Icons
        $cat_table = $wpdb->prefix . 'fsbhoa_categories';
        $categories = $wpdb->get_results("SELECT id, svg_path FROM $cat_table WHERE svg_path IS NOT NULL AND svg_path != ''");
        $icon_library = [];
        foreach ($categories as $cat) {
            $icon_library[$cat->id] = $cat->svg_path;
        }

        // 3. Fetch Root Events & Lineage Map
        // We only start with 'active' roots.
        $roots = $wpdb->get_results("
            SELECT e.*, c.color_hex, l.name as location_name
            FROM $table e
            LEFT JOIN $cat_table c ON e.category_id = c.id
            LEFT JOIN $loc_table l ON e.location_id = l.id
            WHERE e.parent_id IS NULL AND e.status = 'active'
        ");
        error_log("FSBHOA BAKE: Found " . count($roots) . " root events.");
        $lineage_map = $this->build_lineage_map();

        $final_manifest = [];

        // 4. The Processing Loop
        foreach ($roots as $event) {
            if (!empty($event->rrule)) {
                // Series Logic (The Merge-Sort Stream)
                $instances = $this->compile_event_lineage($event, $lineage_map, $range_start, $range_end);
                $final_manifest = array_merge($final_manifest, $instances);
            } else {
                // Single Event Logic (Atomic move/cancel check)
                $single = $this->process_single_root($event, $lineage_map);
                if ($single) {
                    $final_manifest[] = $single;
                }
            }
        }
        error_log("FSBHOA BAKE: Final manifest has " . count($final_manifest) . " instances.");

        // 5. Final Chronological Sort
        usort($final_manifest, function($a, $b) {
            return strcmp($a['sort_key'], $b['sort_key']);
        });

        // 6. Save to Disk with Lock
        $final_output = [
            'icons'  => $icon_library,
            'events' => $final_manifest
        ];

        $dir = dirname($output_path);
        if (!file_exists($dir)) wp_mkdir_p($dir);

        return file_put_contents($output_path, json_encode($final_output), LOCK_EX);
    }

    // build a map of a parent and associated holes, moves, and pivots in time order.
    private function build_lineage_map() {
        global $wpdb;
        $table = $wpdb->prefix . 'fsbhoa_events';

        // Fetch all exceptions (anything with a parent_id)
        $results = $wpdb->get_results("SELECT * FROM $table WHERE parent_id IS NOT NULL ORDER BY start_datetime ASC");

        $map = [];
        foreach ($results as $row) {
            $row->start_dt = new \DateTime($row->start_datetime);
            $map[$row->parent_id][] = $row;
        }
        return $map;
    }


    // Bake a non-repeating event
    private function process_single_root($event, $lineage_map) {
        return $this->format_instance(
                $event, 
                $event->start_datetime, 
                $event->end_datetime, 
                null,
                null);
    }

    // Bake a master's linage
    // Note, only called if the master's rrule is not empty.
    public function compile_event_lineage($master, $lineage_map, $range_start, $range_end) {
        error_log("FSBHOA DEBUG: Master ID {$master->id} DB Start: " . $master->start_datetime . " range " . $range_start . " to " . $range_end);
        $instances = [];
        $range_start_dt = new \DateTime($range_start . ' 00:00:00');
        $range_end_dt   = new \DateTime($range_end . ' 23:59:59');

        // 1. Initial State (The "Era" Metadata)
        $master_id = $master->id;
        $anchor = new \DateTime($master->start_datetime);
  error_log("FSBHOA DEBUG: first anchor: " . $anchor->format('Y-m-d H:i:s'));
        if ($anchor < $range_start_dt) $anchor = $range_start_dt;
        $end = new \DateTime($master->end_datetime);
        $duration = $end->getTimestamp() - $anchor->getTimestamp();
        $meta      = null;  // tracks alternate source of data if not null.

        $rrule = $this->newRRule($master->rrule, $anchor);
        $results = $rrule->getOccurrencesAfter($anchor, true, 1);
        $cursor = !empty($results) ? $results[0] : null;

        $queue = $lineage_map[$master_id] ?? [];

        while ($cursor && $cursor <= $range_end_dt) {
            $next_peek = !empty($queue) ? $queue[0] : null;
        
            // --- STEP A: OVERRIDE DETECTION ---
            if ($next_peek && $next_peek->start_dt->format('Y-m-d') <= $cursor->format('Y-m-d')) {
                $exception = array_shift($queue); // Consume the exception

                // CASE: PIVOT (New Era begins)
                if (!empty($exception->rrule)) {
                    $anchor = clone $exception->start_dt;
                    if ($anchor < $range_start_dt) $anchor = $range_start_dt;
      error_log("FSBHOA DEBUG: new pivot. Anchor=" . $anchor->format('Y-m-d H:i:s'));
                    $rrule = $this->newRRule($exception->rrule, $anchor);

                    $end = new \DateTime($exception->end_datetime);
                    $duration = $end->getTimestamp() - $anchor->getTimestamp();
                
                    // Update the stateful metadata source for all future ticks
                    $meta = $exception; 

                    // Jump the cursor to the first valid date of this new rule
                    $results = $rrule->getOccurrencesAfter($anchor, true, 1);
                    $cursor = !empty($results) ? $results[0] : null;
                    continue; 
                }

                // CASE: HOLE (Single instance cancellation)
                if ($exception->status === 'cancelled') {
                    $results = $rrule->getOccurrencesAfter($cursor, false, 1);
                    $cursor = !empty($results) ? $results[0] : null;
                    continue;
                }

                // CASE: MOVE (Single instance rescheduling)
                $exception_start = new \DateTime($exception->start_datetime);
                $exception_end   = new \DateTime($exception->end_datetime);
                if ($exception_start >= $range_start) {
                    // Pass the MOVE exception as the meda, but still keep original $meta
                    $instances[] = $this->format_instance(
                        $master, 
                        $exception_start, 
                        $exception_end, 
                        $meta,
                        $exception,
                    );
                }
                continue;
            }

            // --- STEP B: STANDARD INSTANCE ---
            if ($cursor >= $range_start_dt) {
                $instance_end = clone $cursor;
                $instance_end->modify("+$duration seconds");
            
                // Here, format_instance uses the metadata from the Master or the last Pivot
                $instances[] = $this->format_instance(
                    $master, 
                    $cursor, 
                    $instance_end,
                    $meta,
                    null);
            }
            $results = $rrule->getOccurrencesAfter($cursor, false, 1);
            $cursor = !empty($results) ? $results[0] : null;
        }

        return $instances;
    }


    private function newRRule($rrule_str, $anchor) {
        // 1. Clean the string (remove any accidental "RRULE:" if it exists)
        $clean_rule = str_ireplace('RRULE:', '', trim($rrule_str));

        // 2. Build a valid RFC string with a forced newline
        // We use the 'Z' suffix or specify the TZ if needed, but since we set
        // date_default_timezone_set in bake(), this format is usually sufficient.
        $rfc_str = "DTSTART:" . $anchor->format('Ymd\THis') . "\n" .
                   "RRULE:" . $clean_rule;

        error_log("FSBHOA COMPILE: RFC string check: " . str_replace("\n", " [NL] ", $rfc_str));

        try {
            return new \RRule\RRule($rfc_str);
        } catch (\Exception $e) {
            error_log("FSBHOA CRITICAL: RRule Parse Failed: " . $e->getMessage());
            // Fallback to a single occurrence if the rule is garbage
            return new \RRule\RRule(['COUNT' => 1, 'DTSTART' => $anchor]);
        }
    }


    // $master: This is always the original root record (ID from the database, that has
    // no parent_id). It provides the default Title, Description, Category, and Color. 
    // Even if you are 5 pivots deep, this is the "Grandparent" that owns the lineage.
    //
    // $start_ts and end_ts:  The start and end date and time for the instance.
    // 
    // $override: (The Specific Instruction): This is the record from your lineage_map. 
    // It is either a Pivot (Active + RRule) or a Move (Active + No RRule). If this 
    // exists, it "talks over" the Master for title.
    //
    private function format_instance($master, $start_dt, $end_dt, $pivot = null, $move = null) {

        if (!($start_dt instanceof \DateTime) || !($end_dt instanceof \DateTime)) {
            error_log("FSBHOA COMPILE: format_instance() received invalid object.");
            return [];
        }
        $title =  $master->title;

        $instance = [
            'id'           => $master->id,
            'pivot_id'     => ($pivot) ? $pivot->id : $master->id,
            'title'        => $title,
            'location'     => $master->location_name ?? 'Lodge',
            'location_id'  => $master->location_id,
            'cat_color'    => $master->color_hex ?? '#eeeeee',
            'category_id'  => $master->category_id,

            'date'         => $start_dt->format('Y-m-d'),  //YYYY-MM-DD
            'start_fmt'    => $start_dt->format('g:i A'),  // e.g. 1:30 PM
            'end_fmt'      => $end_dt->format('g:i A'),    // e.g. 2:30 PM
            'start_time'   => $start_dt->format('H:i'),    // e.g. 13:30
            'end_time'     => $end_dt->format('H:i'),      // e.g. 14:30
            'sort_key'     => $start_dt->format('Y-m-d H:i:s'), // YYYY-MM-DD HH:MM:SS

            'status'       => $master->status ?? 'active',
            'is_ticketed'  => $master->is_ticketed,
            'flyer_url'    => $master->flyer_url,
            'description'  => $master->content,
        ];

        // --- Include only if not empty, reduce JSON file size ---
        if (!empty($master->visibility) && $master->visibility != 'public') {
            $instance['visibility'] = $master->visibility;
        }
        if (!empty($master->cost)) {
            $instance['cost'] = $master->cost;
        }
        if (!empty($master->owner_email)) {
            $instance['owner_email'] = $master->owner_email;
        }
    
        if (!empty($master->setup_notes)) {
            $instance['setup_notes'] = $master->setup_notes;
        }
        if ($move) {
            $instance['move_id'] = $move->id;
        }

        return $instance;
    }

}
