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
            website_url varchar(255) DEFAULT NULL,
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

        // Ensure we have a slug for clean URLs if one isn't provided
        if (empty($data['slug']) && !empty($data['title'])) {
            $data['slug'] = sanitize_title($data['title']) . '-' . bin2hex(random_bytes(2));
        }

        if (isset($data['id'])) {
            $id = $data['id'];
            unset($data['id']);
            $wpdb->update($event_table, $data, ['id' => $id]);
            return $id;
        }

        $wpdb->insert($event_table, $data);
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
}

