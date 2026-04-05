<?php
namespace FSBHOA\Cal;

class Repository {
    private $table_name;

    public function __construct() {
        global $wpdb;
    }

    /**
     * Create the custom table.
     * Called on plugin activation.
     */
    public function create_table() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $events_table = $wpdb->prefix . 'fsbhoa_events';
        $loc_table = $wpdb->prefix . 'fsbhoa_locations';
        $cat_table = $wpdb->prefix . 'fsbhoa_categories';


        $sql = "CREATE TABLE {$events_table} (
            id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            parent_id bigint(20) UNSIGNED DEFAULT NULL,
            title varchar(255) NOT NULL,
            slug varchar(255) NOT NULL,
            content longtext DEFAULT NULL,
            setup_notes text DEFAULT NULL,
            start_datetime datetime NOT NULL,
            end_datetime datetime NOT NULL,
            rrule text DEFAULT NULL,
            location_id int(11) DEFAULT NULL,
            category_id int(11) DEFAULT NULL,
            visibility enum('public', 'resident') DEFAULT 'public',
            owner_email varchar(100) DEFAULT NULL,
            status enum('active', 'cancelled', 'private') DEFAULT 'active',
            ical_uid varchar(255) DEFAULT NULL,
            ical_sequence int(11) DEFAULT 0,
            is_utility tinyint(1) DEFAULT 0,
            is_ticketed tinyint(1) DEFAULT 0,
            cost varchar(50) DEFAULT NULL,
            flyer_url varchar(255) DEFAULT NULL,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY parent_id (parent_id),
            KEY start_datetime (start_datetime),
            UNIQUE KEY slug (slug),
            UNIQUE KEY ical_uid (ical_uid),
            CONSTRAINT fk_event_location FOREIGN KEY (location_id) REFERENCES $loc_table(id) ON DELETE SET NULL,
            CONSTRAINT fk_event_category FOREIGN KEY (category_id) REFERENCES $cat_table(id) ON DELETE SET NULL
        ) $charset_collate;";


        // Categories Table
        $sql_cat = "CREATE TABLE {$cat_table} (
            id int(11) NOT NULL AUTO_INCREMENT,
            name varchar(100) NOT NULL,
            color_hex varchar(7) DEFAULT '#3498db',
            svg_path text,
            PRIMARY KEY (id)
        ) $charset_collate;";

        // Locations Table (Shared with future room app)
        $sql_loc = "CREATE TABLE {$loc_table} (
            id int(11) NOT NULL AUTO_INCREMENT,
            name varchar(100) NOT NULL,
            description text,
            PRIMARY KEY (id)
        ) $charset_collate;";

        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        dbDelta($sql_cat);
        dbDelta($sql_loc);
        dbDelta( $sql );
    }
    
    /**
     * Saves an event to the custom table.
     * Handles both Insert and Update.
     */
    public function save($data) {
        global $wpdb;
        $event_table = $wpdb->prefix . 'fsbhoa_events';

        // get a static whitelist of valid column names.
        static $columns = null;
        if ($columns === null) {
            $table = $wpdb->prefix . 'fsbhoa_events';
            // This query returns just the names of the columns
            $columns = $wpdb->get_col("DESCRIBE $table");
        }

        // Ensure we have a slug for clean URLs if one isn't provided
        if (empty($data['slug']) && !empty($data['title'])) {
            $data['slug'] = sanitize_title($data['title']) . '-' . bin2hex(random_bytes(2));
        }

        // 2. Filter the incoming data
        $data_array = (array) $data;
        $filtered_data = [];

        foreach ($columns as $column) {
            if (array_key_exists($column, $data_array)) {
                $filtered_data[$column] = $data_array[$column];
            }
        }

        if (isset($filtered_data['id'])) {
            $id = $filtered_data['id'];
            unset($filtered_data['id']);
            $wpdb->update($event_table, $filtered_data, ['id' => $id]);
            return $id;
        }

        $wpdb->insert($event_table, $filtered_data);
        return $wpdb->insert_id;
    }

    /**
     * Retrieves a single event from the custom table.
     */
    public function get($id) {
        global $wpdb;
        $event_table = $wpdb->prefix . 'fsbhoa_events';
        $cat_table = $wpdb->prefix . 'fsbhoa_categories';
        $loc_table = $wpdb->prefix . 'fsbhoa_locations';

        return $wpdb->get_row(
            $wpdb->prepare("
                SELECT e.*, c.name as cat_name, c.color_hex, l.name as location_name
                FROM $event_table e
                LEFT JOIN $cat_table c ON e.category_id = c.id
                LEFT JOIN $loc_table l ON e.location_id = l.id
                WHERE e.id = %d",
            $id)
        );
    }

    public function get_all_active() {
        global $wpdb;
        $event_table = $wpdb->prefix . 'fsbhoa_events';
        $cat_table = $wpdb->prefix . 'fsbhoa_categories';
        $loc_table = $wpdb->prefix . 'fsbhoa_locations';

        $results = $wpdb->get_results("
            SELECT e.*, c.name as cat_name, c.color_hex, l.name as location_name
            FROM $event_table e
            LEFT JOIN $cat_table c ON e.category_id = c.id
            LEFT JOIN $loc_table l ON e.location_id = l.id
            ORDER BY e.start_datetime ASC
        ");

        // DEBUG: If you see nothing on the grid, uncomment the next line once,
        // run your "Empty Title Bake", and check your /var/www/html/wp-content/debug.log
        error_log("Bake found " . count($results) . " events.");

        return $results;
    }

    /**
     * Handles the complex logic of reschedualing an event instance.
     */
    public function move_event_instance($master_id, $pivot_id, $move_id, $original_date, $target_date, $target_start_time, $target_end_time, $scope = 'instance') {
        error_log("FSBHOA move_event_instance master: $master_id, pivot: $pivot_id, move: $move_id");

        global $wpdb;
        $event_table = $wpdb->prefix . 'fsbhoa_events';
    
        // Fetch the Master record, for all meta data
        $current = $this->get($master_id);
        if (!$current) return new \WP_Error('not_found', 'Event not found.');

        // Fetch the Pivot (The DNA Source)
        // If no pivot_id is provided, or it matches master, the Master IS the pivot.
        $pivot = (!empty($pivot_id) && $pivot_id != $master_id) ? $this->get($pivot_id) : $current;

        // Identification
        $is_single  = empty($current->rrule);   // This is a one-off event.
        $is_move    = !empty($move_id);         // A previously moved event.
        $is_natural = !$is_single && !$is_move; // Event computed by RRule.

        // --- The Destination ---
        $target_start = "$target_date $target_start_time:00";
        $target_end   = "$target_date $target_end_time:00";

        // ---  THE RECONCILIATION CHECK ---
        // Is there already a 'cancelled' record (a hole) at the destination?
        $collision = $wpdb->get_row($wpdb->prepare(
            "SELECT id, status FROM $event_table
             WHERE parent_id = %d
             AND (rrule IS NULL OR rrule = '')
             AND start_datetime = %s",
            $master_id,
            $target_start
        ));


        // --- SCOPE: SINGLE INSTANCE ---
        if ($is_single) {
            error_log("FSBHOA REPO: Moving Single Event $master_id to $target_start");
            // just change the master record.
            $result = $wpdb->update($event_table,
                [
                    'start_datetime' => $target_start,
                    'end_datetime'   => $target_end
                ],
                ['id' => $master_id]
            );
            error_log("FSBHOA REPO: Update result (rows affected): " . var_export($result, true));
            return ($result !== false);
        }
    
        if ($is_natural) {

            // For the source, get the RAW time strings from the pivot record.
            // $pivot->start_datetime is text like "2026-04-08 08:00:00"
            $dna_start_time = date('H:i:s', strtotime($pivot->start_datetime));
            $dna_end_time   = date('H:i:s', strtotime($pivot->end_datetime));
            $natural_start  = "$original_date $dna_start_time";
            $natural_end    = "$original_date $dna_end_time";
            if ($target_start === $natural_start) {
                // date/time did not actually change, so ignore.
                error_log("FSBHOA REPO: Reschedule to same date/time so ignore.");
                return true;
            }

            error_log("FSBHOA REPO: Reschedule a natural instance from " . $natural_start . " to " . $target_start);

            // Create Hole where natural element is.
            $hole = [
                'parent_id'      => $master_id,
                'title'          => $current->title,  // for debugging only.  May get stale
                'status'         => 'cancelled',
                'start_datetime' => $natural_start,
                'end_datetime'   => $natural_end,
            ];
            $this->save($hole);

            if ($collision && $collision->status === 'cancelled') {
                // moving to an existing hole...remove destination hole.
                $wpdb->delete($event_table, ['id' => $existing_hole->id]);
                return true;
            } 

            // Else, Create move to new location.
            $move = [
                'parent_id'      => $master_id,
                'title'          => $current->title,  // for debugging only.  May get stale
                'status'         => 'active',
                'start_datetime' => $target_start,
                'end_datetime'   => $target_end,
            ];
            return $this->save($move);
        }

        if ($is_move) {   // Moving from a previously moved timeslot.

            if ($collision) {
                if ( $collision->status === 'cancelled') {
                    // We are moving from a moved-to location to a hole location, 
                    // delete both hole and move records.
                    $wpdb->delete($event_table, ['id' => $move_id]);
                    $wpdb->delete($event_table, ['id' => $existing_hole->id]);
                    return true;
                } else {
                    // We are moving from a moved-to location to a another 
                    // moved-to location. Just remove the source. 
                    $wpdb->delete($event_table, ['id' => $move_id]);
                    return true;
                }
            } else {
                // We are moving from a moved-to location to someplace else,
                // Just update the original move record.
                return $wpdb->update($event_table, [
                    'start_datetime' => $target_start, 
                    'end_datetime' => $target_end], 
                    ['id' => $move_id]
                );
            }
        }

        return false;
    }


    /**
     * Deletes all exceptions and pivots belonging to a master starting 
     * from a specific date.
     */
    public function delete_downstream($master_id, $pivot_date, $time_slot) {
        global $wpdb;
        $table = $wpdb->prefix . 'fsbhoa_events';

        return $wpdb->query($wpdb->prepare(
            "DELETE FROM $table
             WHERE parent_id = %d
             AND DATE(start_datetime) > %s
             AND TIME(start_datetime) = %s",
            $master_id,
            $pivot_date,
            $time_slot
        ));
    }
}
