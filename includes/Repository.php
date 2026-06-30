<?php
namespace HOAPLUGIN\Cal;

class Repository {
    private $prefix;

    public function __construct($prefix = null) {
        global $wpdb;
        // If no prefix is passed, use the standard WP one (Production mode)
        $this->prefix = ($prefix) ? $prefix : $wpdb->prefix;
    }

    /**
     * Create the custom table.
     * Called on plugin activation.
     */
    public function create_table() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $events_table = $this->prefix . 'hoaplugin_events';
        $loc_table = $this->prefix . 'hoaplugin_locations';
        $cat_table = $this->prefix . 'hoaplugin_categories';


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
            UNIQUE KEY ical_uid (ical_uid)
        ) $charset_collate;";


        // Categories Table
        $sql_cat = "CREATE TABLE {$cat_table} (
            id int(11) NOT NULL AUTO_INCREMENT,
            name varchar(100) NOT NULL,
            color_hex varchar(7) DEFAULT '#3498db',
            svg_path text,
            delegate_emails text DEFAULT NULL,
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


        // Safely Inject the Foreign Key Separately (Bypassing dbDelta)
        // Check information_schema first to guarantee we never throw a duplicate constraint error
        $constraint_exists = $wpdb->get_var($wpdb->prepare(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND TABLE_NAME = %s
             AND CONSTRAINT_NAME = 'fk_event_category'",
            $events_table
        ));
        if ( ! $constraint_exists ) {
            $wpdb->query(
                "ALTER TABLE $events_table
                 ADD CONSTRAINT fk_event_category
                 FOREIGN KEY (category_id) REFERENCES $cat_table(id)
                 ON DELETE SET NULL"
            );
        }

        // pre-populate initial data.
        if ( !get_option( 'hoaplugin_defaults_installed' ) ) {
            // Only ran once to pre-populate data.
            require_once __DIR__ . '/Defaults.php';
            hoaplugin_populate_default_data( $cat_table, $loc_table, $event_table );
            update_option( 'hoaplugin_defaults_installed', 1 );
        }
    }


    /**
     * Ensures the test tables exist by cloning the schema of the live tables.
     */
    private function prepare_test_tables() {
        global $wpdb;

        // Safety check: Only run this if we are using a test prefix
        if ($this->prefix === $wpdb->prefix || empty($this->prefix)) {
            return;
        }

        $live_events = $wpdb->prefix . 'hoaplugin_events';
        $live_cats   = $wpdb->prefix . 'hoaplugin_categories';
        $live_locs   = $wpdb->prefix . 'hoaplugin_locations';

        $test_events = $this->prefix . 'hoaplugin_events';
        $test_cats   = $this->prefix . 'hoaplugin_categories';
        $test_locs   = $this->prefix . 'hoaplugin_locations';

        // Clone the table structures
        $wpdb->query("CREATE TABLE IF NOT EXISTS $test_events LIKE $live_events");
        $wpdb->query("CREATE TABLE IF NOT EXISTS $test_cats LIKE $live_cats");
        $wpdb->query("CREATE TABLE IF NOT EXISTS $test_locs LIKE $live_locs");
    }
    
    /**
     * Saves an event to the custom table.
     * Handles both Insert and Update.
     */
    public function save($data) {
        global $wpdb;
        $event_table = $this->prefix . 'hoaplugin_events';

        // get a static whitelist of valid column names.
        static $columns = null;
        if ($columns === null) {
            $table = $this->prefix . 'hoaplugin_events';
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

        $result = $wpdb->insert($event_table, $filtered_data);
        if ($result === false) {
            error_log("HOAPLUGIN_CALENDAR FATAL: Database INSERT failed!");
            error_log("Table: " . $event_table);
            error_log("WPDB Error: " . $wpdb->last_error);
            error_log("Attempted Data: " . print_r($filtered_data, true));
            return false;
        }

        return $wpdb->insert_id;
    }

    /**
     * Retrieves a single event from the custom table.
     */
    public function get($id) {
        global $wpdb;
        $event_table = $this->prefix . 'hoaplugin_events';
        $cat_table = $this->prefix . 'hoaplugin_categories';
        $loc_table = $this->prefix . 'hoaplugin_locations';

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

    /**
     * Fetches a master record and all of its child exceptions (pivots,holes,moves).
     */
    public function get_event_family($master_id) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_events';

        $master = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $master_id));

        $children = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE parent_id = %d ORDER BY start_datetime ASC",
            $master_id
        ));

        return [
            'master' => $master,
            'children' => $children
        ];
    }

    public function get_all_active() {
        global $wpdb;
        $event_table = $this->prefix . 'hoaplugin_events';
        $cat_table = $this->prefix . 'hoaplugin_categories';
        $loc_table = $this->prefix . 'hoaplugin_locations';

        $results = $wpdb->get_results("
            SELECT e.*, c.name as cat_name, c.color_hex, l.name as location_name
            FROM $event_table e
            LEFT JOIN $cat_table c ON e.category_id = c.id
            LEFT JOIN $loc_table l ON e.location_id = l.id
            ORDER BY e.start_datetime ASC
        ");

        // DEBUG: If you see nothing on the grid, uncomment the next line once,
        // run your "Empty Title Bake", and check your /var/www/html/wp-content/debug.log
        error_log("All records, found  " . count($results) . " events.");

        return $results;
    }

    public function get_locations() {
        global $wpdb;
        $locations = $wpdb->get_results("SELECT id, name FROM {$this->prefix}hoaplugin_locations");
        return $locations;
    }

    public function get_categories() {
        global $wpdb;
        $categories = $wpdb->get_results("SELECT id, name, color_hex, svg_path, delegate_emails FROM {$this->prefix}hoaplugin_categories");
        return $categories;
    }


    public function cancel_series($master_id) {
        global $wpdb;
        $wpdb->update(
                    $this->prefix . 'hoaplugin_events',
                    ['status' => 'cancelled'],
                    ['id' => $master_id]
                );
    }

    public function delete_series($master_id) {
        global $wpdb;
        $wpdb->delete($this->prefix . 'hoaplugin_events', ['id' => $master_id]);
        $wpdb->delete($this->prefix . 'hoaplugin_events', ['parent_id' => $master_id]);
    }



    public function restore_hole($master_id, $target_date) {
        global $wpdb;
        // $target_date is the date of the cell clicked.
        // We look for the first record >= that date that is 'cancelled'.
        $hole_to_remove = $wpdb->get_var($wpdb->prepare(
             "SELECT id FROM {$this->prefix}hoaplugin_events
                    WHERE parent_id = %d
                    AND status = 'cancelled'
                    AND start_datetime >= %s
                    ORDER BY start_datetime ASC
                    LIMIT 1",
                   $master_id,
                   $target_date . ' 00:00:00'
        ));

        if ($hole_to_remove) {
            $wpdb->delete($this->prefix . 'hoaplugin_events', ['id' => $hole_to_remove]);
            error_log("HOAPLUGIN REPO: Undeleted instance. Removed hole ID: $hole_to_remove");
        } else {
             error_log("HOAPLUGIN REPO: No future holes found to undelete for Master ID: $master_id");
        }
    }

    /**
     * Ends a series by adding an UNTIL clause to the RRule.
     */
    public function end_series($pivot_id, $until_date_str) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_events';

        $existing = $this->get($pivot_id);
        if (!$existing || empty($existing->rrule)) return false;

        // Clean and append UNTIL
        $clean = preg_replace('/;(UNTIL|COUNT)=[^;]+/', '', trim(str_ireplace('RRULE:', '', $existing->rrule)));
        $new_rrule = rtrim($clean, ';') . ";UNTIL=" . $until_date_str;

        return $wpdb->update($table, ['rrule' => $new_rrule], ['id' => $pivot_id]);
    }


    public function resume_series($pivot_id, $target_date) {
        global $wpdb;
        // 1. Remove the UNTIL clause from the Pivot/Master
        $existing_pivot = $this->get($pivot_id);
        if ($existing_pivot && !empty($existing_pivot->rrule)) {
            $master_id = $existing_pivot->id;

            // Strip UNTIL and COUNT to make it infinite again
            $new_rrule = preg_replace('/;(UNTIL|COUNT)=[^;]+/', '', $existing_pivot->rrule);
            $wpdb->update($this->prefix . 'hoaplugin_events',
                ['rrule' => $new_rrule],
                ['id' => $pivot_id]
            );
            error_log("HOAPLUGIN REPO: Series resumed. RRule updated for ID: $pivot_id");
        }

        // 2. Clean up all future pivots, holes and moves for this lineage
        $this->delete_downstream($master_id, $target_date, '00:00:00', $pivot_id);
    }


    /**
     * Handles the complex logic of reschedualing an event instance.
     */
    public function move_event_instance($master_id, $pivot_id, $move_id, $original_date, $target_date, $target_start_time, $target_end_time, $scope = 'instance') {
        error_log("HOAPLUGIN move_event_instance master: $master_id, pivot: $pivot_id, move: $move_id");

        global $wpdb;
        $event_table = $this->prefix . 'hoaplugin_events';
    
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

        // --- SCOPE: REMAINING INSTANCES (THE PIVOT) ---
        if ($scope === 'remaining') {
            error_log("HOAPLUGIN REPO: Pivoting series from $original_date to $target_date");

            // 1. Calculate the shifted RRule
            $old_rrule = $pivot->rrule;
            $new_rrule = $this->shift_rrule($old_rrule, $original_date, $target_date);

            // 2. Prepare the DNA payload
            $dna_data = [
                'title'          => $current->title,
                'rrule'          => $new_rrule,
                'start_datetime' => "$original_date $target_start_time:00",
                'end_datetime'   => "$original_date $target_end_time:00"
            ];

            // 3. Delegate to your existing pivot engine
            // Pass $original_date (Monday) so it knows where to draw the deletion line!
            $this->maybe_pivot_series($pivot_id, $dna_data, $original_date);

            return true;
        }

        // --- SCOPE: SINGLE INSTANCE ---
        if ($is_single) {
            error_log("HOAPLUGIN REPO: Moving Single Event $master_id to $target_start");
            // just change the master record.
            $result = $wpdb->update($event_table,
                [
                    'start_datetime' => $target_start,
                    'end_datetime'   => $target_end
                ],
                ['id' => $master_id]
            );
            error_log("HOAPLUGIN REPO: Update result (rows affected): " . var_export($result, true));
            return ($result !== false);
        }
    
        if ($is_natural) {

            // For the source, get the RAW time strings from the pivot record.
            // $pivot->start_datetime is text like "2026-04-08 08:00:00"
            $dna_start_time = substr($pivot->start_datetime, 11, 8);
            $dna_end_time   = substr($pivot->end_datetime, 11, 8);
            $natural_start  = "$original_date $dna_start_time";
            $natural_end    = "$original_date $dna_end_time";
            if ($target_start === $natural_start) {
                // date/time did not actually change, so ignore.
                error_log("HOAPLUGIN REPO: Reschedule to same date/time so ignore.");
                return true;
            }

            error_log("HOAPLUGIN REPO: Reschedule a natural instance from " . $natural_start . " to " . $target_start);

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
                    error_log("move_event_instance()  moving from Moved-to location to hole.");
                    $wpdb->delete($event_table, ['id' => $move_id]);
                    $wpdb->delete($event_table, ['id' => $collision->id]);
                    return true;
                } else {
                    // We are moving from a moved-to location to a another 
                    // moved-to location. Just remove the source. 
                    error_log("move_event_instance()  moving from Moved-to location to another Moved-to.");
                    $wpdb->delete($event_table, ['id' => $move_id]);
                    return true;
                }
            } else {
                // We are moving from a moved-to location to someplace else,
                // Just update the original move record.
                error_log("move_event_instance()  moving from Moved-to location to another place.");
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
     * Saves DNA fields: the rrule, start and end datetimes.
     * 1) Find active rule. We look for pivot point or master closest
     *    but <= to the pivot date.
     * 2) If the DNA fields have not changed, return; nothing to do.
     * 3) If the start_datetime is the same, save the DNA fields in-place
     *    and delete all pivots, exceptions, and holes that follow.
     * 4) else, create a new pivot record with the DNA fields.
     * Note:  If the pivot date is in the past, move the pivot date to today.
     */
    public function maybe_pivot_series($pivot_id, $dna_data, $clicked_date) {
        global $wpdb;
        $active_rule = $this->get($pivot_id);
        if (!$active_rule) {
            error_log("HOAPLUGIN PIVOT: Could not find Pivot record $pivot_id");
            return; // Should not happen if Master exists
        }
        $master_id = !empty($active_rule->parent_id) ? $active_rule->parent_id : $active_rule->id;

        $today_str = date('Y-m-d');
        $pivot_date = date('Y-m-d', strtotime($clicked_date));
        $first_instance_date = $this->get_first_instance_date($active_rule->start_datetime, $active_rule->rrule);

        error_log(" --- PIVOT DEBUG ---");
        error_log(" Anchor Date:       " . $active_rule->start_datetime);
        error_log(" TRUE 1st Instance: " . $first_instance_date);
        error_log(" Clicked Date: " . $clicked_date);
        error_log(" Comparing: [" . $first_instance_date . "] === [" . $pivot_date . "]");

        // --- 3. DNA CHANGE DETECTION ---
        $new_start_time = date('H:i', strtotime($dna_data['start_datetime']));
        $new_end_time   = date('H:i', strtotime($dna_data['end_datetime']));
        $old_start_time = date('H:i', strtotime($active_rule->start_datetime));
        $old_end_time   = date('H:i', strtotime($active_rule->end_datetime));
        $old_start_time_full = date('H:i:s', strtotime($active_rule->start_datetime));

        $dna_changed = (
            $active_rule->rrule !== $dna_data['rrule'] ||
            $old_start_time !== $new_start_time ||
            $old_end_time !== $new_end_time
        );

        if (!$dna_changed) {
            // nothing to do.
            error_log("HOAPLUGIN PIVOT: No DNA change detected. Skipping.");
            return;
        }

        error_log("HOAPLUGIN PIVOT check: DNA changed id=$pivot_id");

        if ($first_instance_date === $pivot_date) {
            // CASE: Update In-Place (editing the first instance)
            error_log("HOAPLUGIN PIVOT: Updating existing record ID {$active_rule->id} in-place.");

            // update pivot record (or master)
            $this->save([
                'id'             => $active_rule->id,
                'rrule'          => $dna_data['rrule'],
                'start_datetime' => $dna_data['start_datetime'], // Use passed value natively
                'end_datetime'   => $dna_data['end_datetime']
            ]);

            // Nuke all downstream children of the master for this era
            $this->delete_downstream($master_id, $pivot_date, $old_start_time_full, $active_rule->id);
        } else {
            // CASE: Create New Pivot
            // We are branching off from an older rule.
            error_log("HOAPLUGIN PIVOT: Creating new pivot era starting $pivot_date.");

            // 1. Nuke downstream first to clear the path
            $this->delete_downstream($master_id, $pivot_date, $old_start_time_full);

            // 2. Insert the new Pivot
            $this->save([
                'parent_id'      => $master_id,
                'title'          => $dna_data['title'] ?? '',
                'rrule'          => $dna_data['rrule'],
                'start_datetime' => $dna_data['start_datetime'], // Use passed value natively
                'end_datetime'   => $dna_data['end_datetime'],
                'status'         => 'active'
            ]);
        }
    }

    /**
     * Deletes all exceptions and pivots belonging to a master starting 
     * from a specific date.
     */
    public function delete_downstream($master_id, $pivot_date, $time_slot, $exclude_id = null) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_events';

        // We use a complex WHERE clause to handle the "Same day later" and "Future days"
        $sql = "DELETE FROM $table
                WHERE parent_id = %d
                AND (
                    (DATE(start_datetime) = %s AND TIME(start_datetime) >= %s)
                    OR
                    (DATE(start_datetime) > %s)
                )";

        $params = [$master_id, $pivot_date, $time_slot, $pivot_date];

        // CRITICAL: Ensure we don't delete the record we just created/modified
        if ($exclude_id) {
            $sql .= " AND id != %d";
            $params[] = $exclude_id;
        }
        return $wpdb->query($wpdb->prepare($sql, ...$params));
    }

    /**
     * Standardizes extraction of H:i:s from a DB record to prevent TZ shifts.
     */
    private function get_dna_times($record) {
        return [
            'start' => substr($record->start_datetime, 11, 8), // "08:00:00"
            'end'   => substr($record->end_datetime, 11, 8)    // "09:00:00"
        ];
    }


    // We need to know if this user is a delegate on any event or cateogry
    // so we know to load the edit modules.
    public function is_user_delegate($email) {
        global $wpdb;
        if (empty($email)) return false;

        // 1. Check Event-level delegation
        $event_table = $this->prefix . 'hoaplugin_events';
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $event_table WHERE owner_email = %s",
            $email
        ));
        if ($count > 0) return true;

        // 2. Check Category-level delegation
        $cat_table = $this->prefix . 'hoaplugin_categories';
        $cats = $wpdb->get_results("SELECT delegate_emails FROM $cat_table WHERE delegate_emails IS NOT NULL AND delegate_emails != ''");
        foreach ($cats as $cat) {
            $emails = array_map('trim', explode(',', strtolower($cat->delegate_emails)));
            if (in_array(strtolower($email), $emails)) return true;
        }

        return false;
    }

    // Extracts exactly which categories a specific email is allowed to manage
    public function get_user_delegated_categories($email) {
        global $wpdb;
        $allowed_cats = [];
        if (empty($email)) return $allowed_cats;

        $cat_table = $this->prefix . 'hoaplugin_categories';
        $cats = $wpdb->get_results("SELECT id, delegate_emails FROM $cat_table WHERE delegate_emails IS NOT NULL AND delegate_emails != ''");
        foreach ($cats as $cat) {
            $emails = array_map('trim', explode(',', strtolower($cat->delegate_emails)));
            if (in_array(strtolower($email), $emails)) {
                $allowed_cats[] = (int) $cat->id;
            }
        }
        return $allowed_cats;
    }

    // Gatekeeper check for the backend AJAX receiver
    public function is_category_delegate($email, $category_id) {
        global $wpdb;
        if (empty($email) || empty($category_id)) return false;

        $table = $this->prefix . 'hoaplugin_categories';
        $cat = $wpdb->get_row($wpdb->prepare("SELECT delegate_emails FROM $table WHERE id = %d", $category_id));

        if ($cat && !empty($cat->delegate_emails)) {
            $emails = array_map('trim', explode(',', strtolower($cat->delegate_emails)));
            return in_array(strtolower($email), $emails);
        }
        return false;
    }

    /**
     * Loads a JSON fixture into the database.
     * CRITICAL: Strictly checks the prefix to prevent live database corruption.
     */
    public function load_fixture($fixture_data) {
        global $wpdb;

        // --- THE KILL SWITCH ---
        if ($this->prefix === $wpdb->prefix || empty($this->prefix)) {
            error_log("CRITICAL: Repository->load_fixture aborted. Prefix matches live database!");
            wp_die("CRITICAL SAFETY ABORT: Refusing to truncate live database tables.", '', 500);
        }
        // CREATE THE TABLES FIRST!
        $this->prepare_test_tables();

        $event_table = $this->prefix . 'hoaplugin_events';
        $cat_table   = $this->prefix . 'hoaplugin_categories';
        $loc_table   = $this->prefix . 'hoaplugin_locations';

        // 1. Wipe the test slate cleanly
        $wpdb->query("TRUNCATE TABLE $event_table");
        $wpdb->query("TRUNCATE TABLE $cat_table");
        $wpdb->query("TRUNCATE TABLE $loc_table");

        $id_map = []; // Maps JSON _refs to real MySQL IDs

        // 2. Insert Locations
        if (!empty($fixture_data['locations'])) {
            foreach ($fixture_data['locations'] as $loc) {
                $wpdb->insert($loc_table, [
                    'name' => sanitize_text_field($loc['name']),
                    'description' => sanitize_text_field($loc['description'] ?? '')
                ]);
                if (isset($loc['_ref'])) $id_map[$loc['_ref']] = $wpdb->insert_id;
            }
        }

        // 3. Insert Categories
        if (!empty($fixture_data['categories'])) {
            foreach ($fixture_data['categories'] as $cat) {
                $wpdb->insert($cat_table, [
                    'name' => sanitize_text_field($cat['name']),
                    'color_hex' => sanitize_hex_color($cat['color_hex'] ?? '#3498db'),
                    'svg_path' => wp_kses_post($cat['svg_path'] ?? '')
                ]);
                if (isset($cat['_ref'])) $id_map[$cat['_ref']] = $wpdb->insert_id;
            }
        }

        // 4. Insert Events
        if (!empty($fixture_data['events'])) {
            foreach ($fixture_data['events'] as $evt) {
                // Translate relative English dates into MySQL dates (e.g. "tomorrow" -> "2026-05-19")
                $real_date = date('Y-m-d', strtotime($evt['start_date']));

                $data = [
                    'title' => sanitize_text_field($evt['title']),
                    'start_datetime' => "$real_date {$evt['start_time']}",
                    'end_datetime' => "$real_date {$evt['end_time']}",
                    'status' => sanitize_text_field($evt['status'] ?? 'active'),
                    'rrule' => sanitize_text_field($evt['rrule'] ?? null),
                    'flyer_url' => esc_url_raw($evt['flyer_url'] ?? ''),
                    'content'        => wp_kses_post($evt['content'] ?? ''),
                    'is_ticketed'    => isset($evt['is_ticketed']) ? intval($evt['is_ticketed']) : 0,
                    'visibility'     => sanitize_text_field($evt['visibility'] ?? 'public'),
                    'cost'           => sanitize_text_field($evt['cost'] ?? ''),
                    'owner_email'    => sanitize_email($evt['owner_email'] ?? ''),
                    'setup_notes'    => sanitize_textarea_field($evt['setup_notes'] ?? '')
                ];

                // Resolve Foreign Keys using our internal ID map
                if (isset($evt['location_ref']) && isset($id_map[$evt['location_ref']])) {
                    $data['location_id'] = $id_map[$evt['location_ref']];
                }
                if (isset($evt['category_ref']) && isset($id_map[$evt['category_ref']])) {
                    $data['category_id'] = $id_map[$evt['category_ref']];
                }
                if (isset($evt['parent_ref']) && isset($id_map[$evt['parent_ref']])) {
                    $data['parent_id'] = $id_map[$evt['parent_ref']];
                }

                $new_id = $this->save($data); // Use the native save method!
                if (isset($evt['_ref'])) $id_map[$evt['_ref']] = $new_id;
            }
        }

        return $id_map;
    }

    /**
     * Empties the test tables. Called by TestRunner->cleanup().
     */
    public function cleanup_test_tables() {
        global $wpdb;

        // --- THE KILL SWITCH ---
        if ($this->prefix === $wpdb->prefix || empty($this->prefix)) {
            error_log("CRITICAL: Repository->cleanup_test_tables aborted.");
            wp_die("CRITICAL SAFETY ABORT: Refusing to truncate live database tables.", '', 500);
        }

        // Nuke the test schemas completely
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}hoaplugin_events");
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}hoaplugin_categories");
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}hoaplugin_locations");

    }

    /**
     * Intelligently shifts an RRule when a series is dragged to a new date.
     * Preserves complex frequency prefixes like 2nd, 4th, or Last (-1).
     */
    private function shift_rrule($rrule, $original_date, $target_date) {
        if (empty($rrule)) return '';

        $orig_time = strtotime($original_date);
        $target_time = strtotime($target_date);

        // Extract day of week abbreviation (e.g. 'Monday' -> 'MO')
        $orig_dow = strtoupper(substr(date('l', $orig_time), 0, 2));
        $target_dow = strtoupper(substr(date('l', $target_time), 0, 2));
        $target_day_num = date('j', $target_time);

        // Parse the RRule string into an associative array
        $parts = explode(';', $rrule);
        $rule_data = [];
        foreach ($parts as $part) {
            if (strpos($part, '=') !== false) {
                list($key, $val) = explode('=', $part);
                $rule_data[$key] = $val;
            }
        }

        // Shift Days of the Week (Handles 'MO', '2SA,4SA', '-1WE', etc.)
        if (isset($rule_data['BYDAY'])) {
            $days = explode(',', $rule_data['BYDAY']);
            foreach ($days as $k => $day) {
                // Regex matches an optional number/minus sign, followed by exactly 2 letters
                preg_match('/^(-?\d+)?([A-Z]{2})$/', $day, $matches);
                $prefix = $matches[1] ?? '';
                $dow    = $matches[2] ?? '';

                // Only shift the specific day that was dragged
                if ($dow === $orig_dow) {
                    $days[$k] = $prefix . $target_dow;
                }
            }
            // array_unique prevents 'TU,TU' if they dragged 'MO,TU' onto a Tuesday
            $rule_data['BYDAY'] = implode(',', array_unique($days));
        }

        // Shift absolute Month Dates (e.g. 15th of the month)
        if (isset($rule_data['BYMONTHDAY'])) {
            $rule_data['BYMONTHDAY'] = $target_day_num;
        }

        // Reassemble the RRule string
        $new_parts = [];
        foreach ($rule_data as $key => $val) {
            $new_parts[] = "$key=$val";
        }
        return implode(';', $new_parts);
    }



    /**
     * Calculates the true first occurrence of an event sequence.
     * If the RRule starts on a Friday but specifies BYDAY=MO,
     * this returns the date of that first Monday.
     *
     * @param string $start_datetime The anchor date/time from the database.
     * @param string $rrule The RRule string.
     * @return string YYYY-MM-DD of the true first occurrence.
     */
    public function get_first_instance_date($start_datetime, $rrule) {
        $anchor = new \DateTime($start_datetime);
        $first_date = $anchor->format('Y-m-d'); // Default to anchor

        if (empty($rrule)) {
            return $first_date;
        }

        $clean_rule = trim(str_ireplace('RRULE:', '', $rrule));
        $parts = [];
        foreach (explode(';', $clean_rule) as $pair) {
            if (strpos($pair, '=') !== false) {
                list($key, $value) = explode('=', $pair);
                $parts[trim($key)] = trim($value);
            }
        }
        $parts['DTSTART'] = $anchor;

        try {
            $rrule_obj = new \RRule\RRule($parts);
            // Get the first occurrence inclusive of the anchor
            $occurrences = $rrule_obj->getOccurrencesAfter($anchor, true, 1);
            if (!empty($occurrences)) {
                $first_date = $occurrences[0]->format('Y-m-d');
            }
        } catch (\Exception $e) {
            error_log("HOAPLUGIN RRULE HELPER ERROR: " . $e->getMessage());
        }

        return $first_date;
    }


    /**
     * Fetches the most recent events for the Audit Log.
     * Groups children with their master parents chronologically.
     */
    public function get_audit_log_events($limit = 200) {
        global $wpdb;
        $table_events = $this->prefix . 'hoaplugin_events';
        $table_cats   = $this->prefix . 'hoaplugin_categories';

        // Force the limit to be an integer for absolute safety
        $safe_limit = intval($limit);

        return $wpdb->get_results("
            SELECT e.*, c.name as cat_name
            FROM $table_events e
            LEFT JOIN $table_cats c ON e.category_id = c.id
            ORDER BY COALESCE(e.parent_id, e.id) DESC, (CASE WHEN e.parent_id IS NULL THEN 0 ELSE 1 END) ASC, e.id ASC
            LIMIT $safe_limit
        ");
    }



    // --- LOCATION CRUD ---
    public function save_location($data) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_locations';
        if (!empty($data['id'])) {
            return $wpdb->update($table, ['name' => $data['name']], ['id' => intval($data['id'])]);
        } else {
            return $wpdb->insert($table, ['name' => $data['name']]);
        }
    }

    public function delete_location($id) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_locations';
        return $wpdb->delete($table, ['id' => intval($id)]);
    }

    // --- CATEGORY CRUD ---
    public function save_category($data) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_categories';
        $update_data = [
            'name'            => $data['name'],
            'color_hex'       => $data['color_hex'],
            'svg_path'        => $data['svg_path'],
            'delegate_emails' => $data['delegate_emails']
        ];
        if (!empty($data['id'])) {
            return $wpdb->update($table, $update_data, ['id' => intval($data['id'])]);
        } else {
            return $wpdb->insert($table, $update_data);
        }
    }

    public function delete_category($id) {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_categories';
        return $wpdb->delete($table, ['id' => intval($id)]);
    }

    // --- COMPILER DATA FETCHERS ---
    public function get_active_roots() {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_events';
        $cat_table = $this->prefix . 'hoaplugin_categories';
        $loc_table = $this->prefix . 'hoaplugin_locations';

        return $wpdb->get_results("
            SELECT e.*, c.color_hex, l.name as location_name
            FROM $table e
            LEFT JOIN $cat_table c ON e.category_id = c.id
            LEFT JOIN $loc_table l ON e.location_id = l.id
            WHERE e.parent_id IS NULL AND e.status = 'active'
        ");
    }

    public function get_lineage_exceptions() {
        global $wpdb;
        $table = $this->prefix . 'hoaplugin_events';
        return $wpdb->get_results("SELECT * FROM $table WHERE parent_id IS NOT NULL ORDER BY start_datetime ASC");
    }
}
