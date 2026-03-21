<?php
namespace FSBHOA\Cal;

use RRule\RRule;

class Compiler {

    public function bake() {
        global $wpdb;
        $repo = new Repository();

        // 1. Get Configuration from WP Options
        $past_months   = get_option('fsb_cal_past_months', 1);   // Default: 1 month back
        $future_months = get_option('fsb_cal_future_months', 12); // Default: 12 months forward

        $upload_dir   = wp_upload_dir();
        $default_path = $upload_dir['basedir'] . '/fsbhoa-calendar/calendar-events.json';
        $output_path  = get_option('fsb_cal_json_path', $default_path);

        $dir = dirname($output_path);
        if (!file_exists($dir)) {
            wp_mkdir_p($dir); // WordPress helper to create folders recursively
        }

        // --- FETCH CATEGORY ICON LIBRARY ---
        $cat_table = $wpdb->prefix . 'fsbhoa_categories';
        $categories = $wpdb->get_results("SELECT id, svg_path FROM $cat_table WHERE svg_path IS NOT NULL AND svg_path != ''");

        $icon_library = [];
        foreach ($categories as $cat) {
            $icon_library[$cat->id] = $cat->svg_path;
        }

        // 2. Calculate the dynamic range
        $start = date('Y-m-01', strtotime("-{$past_months} months"));
        $end   = date('Y-m-t',  strtotime("+{$future_months} months"));

        // 3. Bake the JSON
        $raw_events = $repo->get_all_active();
        $compiled = $this->compile($raw_events, $start, $end);

        $final_output = [
            'icons'  => $icon_library,
            'events' => $compiled
        ];
        return file_put_contents($output_path, json_encode($final_output));
    }



    public function compile($events, $start_range, $end_range) {
        $compiled = [];

        // 1. Separate parents and moved instances from holes.
        $generators = array_filter($events, fn($e) => $e->status === 'active');
        $holes = array_filter($events, fn($e) => $e->status === 'cancelled' && !empty($e->parent_id));

        $exclusion_map = [];
        foreach ($holes as $hole) {
            $date_key = date('Y-m-d', strtotime($hole->start_datetime));
            $flat_key = $hole->parent_id . '-' . $date_key;
            $exclusion_map[$flat_key] = 'cancelled';
        }


        foreach ($generators as $event) {
            $title = html_entity_decode($event->title, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $start_time = date('g:i A', strtotime($event->start_datetime));
            $end_time   = date('g:i A', strtotime($event->end_datetime));
    
            $base_data = [
                'id'           => $event->id,
                'title'        => $title,
                'location'     => $event->location_name ?? 'Lodge',
                'location_id'  => $event->location_id,
                'cat_color'    => $event->color_hex ?? '#eeeeee',
                'category_id'  => $event->category_id,
                'visibility'   => $event->visibility,
                'start_time'   => $start_time,
                'end_time'     => $end_time,
                'status'       => $event->status ?? 'active',
                'cost'         => $event->cost,
                'is_ticketed'  => $event->is_ticketed,
                'flyer_url'    => $event->website_url,
                'description'  => $event->content,
                'sort_time'    => strtotime($event->start_datetime),
            ];

            if (!empty($event->rrule)) {
                try {
                    $rrule = new RRule($event->rrule, $event->start_datetime);
                    $instances = $rrule->getOccurrencesBetween($start_range, $end_range);

                    foreach ($instances as $dt) {
                        $occurrence_date = $dt->format('Y-m-d');
                        $lookup_key = $event->id . '-' . $occurrence_date;


                        // 3. THE PUNCH-OUT LOGIC (Using full timestamp)
                        if (isset($exclusion_map[$lookup_key])) {
                            if ($exclusion_map[$lookup_key] === 'cancelled') {
                                // Event is suppressed.
                                continue; 
                            }
                        }

                        // No override? Use the Master's status for the first instance check
                        $instance = $base_data;
                        $instance['date'] = $occurrence_date;
                    
                        // Apply Master status (handles if the very first meeting is 'cancelled')
                        $instance['status'] = $event->status;

                        $compiled[] = $instance;
                    }
                } catch (\Exception $e) {
                    continue;
                }
            } else {
                // Standard single events + Additions/Custom Days
                $date_str = date('Y-m-d', strtotime($event->start_datetime));
                if ($date_str >= $start_range && $date_str <= $end_range) {
                    $instance = $base_data;
                    $instance['date'] = $date_str;
                    $compiled[] = $instance;
                }
            }
        }


        // Sort by date, then by time
        usort($compiled, function($a, $b) {
            if ($a['date'] === $b['date']) {
                return strcmp($a['sort_time'], $b['sort_time']);
            }
            return strcmp($a['date'], $b['date']);
        });

        return $compiled;
    }


}
