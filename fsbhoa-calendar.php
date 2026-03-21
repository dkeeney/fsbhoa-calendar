<?php
/**
 * Plugin Name: FSBHOA Calendar
 * Description: The complete HOA event engine (display + Compiler).
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

use FSBHOA\Cal\Repository;
use FSBHOA\Cal\Compiler;

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/admin/settings-page.php';

// 1. Activation
register_activation_hook( __FILE__, function() {
    $repo = new Repository();
    $repo->create_table();

    // Set the default JSON path if it doesn't exist
    if (!get_option('fsb_cal_json_path')) {
        $upload_dir = wp_upload_dir();
        $default_path = $upload_dir['basedir'] . '/fsbhoa-calendar/calendar-events.json';
        update_option('fsb_cal_json_path', $default_path);
    }
});

// Register the uninstall hook
// This will also remove monthly calendar backgrounds.
register_uninstall_hook(__FILE__, 'fsb_cal_cleanup');

function fsb_cal_cleanup() {
    // 1. Remove the settings from the database
    delete_option('fsb_calendar_bgs');

    // 2. Locate and delete the upload folder
    $upload_dir = wp_upload_dir();
    $fsb_dir = $upload_dir['basedir'] . '/fsbhoa-calendar';

    if (file_exists($fsb_dir)) {
        // Simple recursive delete function
        array_map('unlink', glob("$fsb_dir/*.*"));
        rmdir($fsb_dir);
    }
}

add_action('wp_enqueue_scripts', function() {
    // Only load if the shortcode is present
    if (!is_a(get_post(), 'WP_Post') || !has_shortcode(get_post()->post_content, 'fsbhoa_calendar')) {
        return;
    }

    // 1. Enqueue the script first
    wp_enqueue_script('fsb-cal-logic', plugins_url('assets/js/calendar-logic.js', __FILE__), array('jquery'), '1.1', true);
    wp_enqueue_style('fsb-cal-style', plugins_url('assets/css/calendar-style.css', __FILE__));

    // 2. Fetch data for the JS
    global $wpdb;
    $locations = $wpdb->get_results("SELECT id, name FROM {$wpdb->prefix}fsbhoa_locations");
    $categories = $wpdb->get_results("SELECT id, name FROM {$wpdb->prefix}fsbhoa_categories");
    $upload_dir = wp_upload_dir();

    // 3. Localize ONE TIME with all data
    wp_localize_script('fsb-cal-logic', 'fsb_config', array(
        'ajax_url'      => admin_url('admin-ajax.php'),
        'nonce'         => wp_create_nonce('fsb_cal_nonce'),
        'bg_base_url'   => $upload_dir['baseurl'] . '/fsbhoa-calendar/backgrounds/',
        'past_limit'    => (int)get_option('fsb_cal_past_months', 1),
        'future_limit'  => (int)get_option('fsb_cal_future_months', 12),
        'locations'     => $locations,
        'categories'    => $categories,
        'time_position' => get_option('fsb_time_position', 'prepend'),
        'version'       => time()
    ));
});

add_shortcode('fsbhoa_calendar', function() {
    // Determine the JSON path 
    $json_url = admin_url('admin-ajax.php') . '?action=fsb_get_calendar_json';
    $json_url .= '&v=' . get_option('fsb_cal_version', time());  // cache-buster


    // Get WP User Data
    $current_user = wp_get_current_user();
    $user_email = $current_user->user_email;
    $is_admin = current_user_can('manage_options') ? 'true' : 'false';

    ob_start();
    ?>
    <div id="fsb-fullscreen-wrapper">
        <div id="fsb-calendar-app" data-json-url="<?php echo esc_url($json_url); ?>" data-user-email="<?php echo esc_attr($user_email); ?>" data-is-admin="<?php echo $is_admin; ?>">
            <button type="button" id="prevMonth" class="nav-arrow prev">&#10094;</button>
            <button type="button" id="nextMonth" class="nav-arrow next">&#10095;</button>
            <div id="fsb-calendar-container">
                <h2 id="currentMonthDisplay" style="display:none;"></h2>
                <div id="calendar-grid" class="calendar-grid"></div>
                <div id="fsb-detail-modal" class="fsb-full-modal">
                    <div class="modal-backdrop"></div>
                    <div class="modal-window">
                        <button class="modal-close" onclick="closeDetailModal()">&times;</button>
                        <div id="modal-content-area">
                        </div>
                    </div>
                </div>
                <div id="fsb-edit-modal" class="fsb-modal">
                    <div class="modal-content">
                        <span class="close-modal">&times;</span>
                        <div id="edit-form-container"></div>
                    </div>
                </div>
            </div>
            <div class="calendar-footer-toolbar">
                <div class="toolbar-left">
                    <button type="button" id="jumpToday" class="fsb-mini-btn">Today</button>
                    <button type="button" id="toggleFullScreen" class="fsb-mini-btn">⛶ Fullscreen</button>
                </div>
    
                <div class="toolbar-right">
                    <button type="button" id="printCal" class="fsb-mini-btn">Print (PDF)</button>
                    <label class="mini-label">
                        <input type="checkbox" id="toggle-magnifier" checked> Magnifier
                    </label>
                    <select id="viewSelector" class="fsb-mini-select">
                        <option value="month">Monthly</option>
                        <option value="agenda">Agenda</option>
                    </select>
                </div>
            </div>
        </div>
    </div>


    <?php
    return ob_get_clean();
});


// Use 'admin_init' to catch the redirect back from options.php
add_action('admin_init', function() {
    // Check if we just came back from saving our specific settings group
    if (isset($_GET['page']) && $_GET['page'] === 'fsb-cal-settings' && isset($_GET['settings-updated'])) {
        $compiler = new \FSBHOA\Cal\Compiler();
        $compiler->bake();
    }
});


// Listen for the "Get Details" call
// We wait until an edit screen is requested before getting the details.
add_action('wp_ajax_fsb_get_event_details', 'fsb_handle_get_event_details');

function fsb_handle_get_event_details() {
    check_ajax_referer('fsb_cal_nonce', 'nonce');

    $event_id = isset($_GET['event_id']) ? intval($_GET['event_id']) : 0;
    if (!$event_id) wp_send_json_error('Invalid ID');

    $repo = new \FSBHOA\Cal\Repository();
    $event = $repo->get($event_id); // This uses your JOINed get() method

    if ($event) {
        // Map DB fields to JS-friendly keys if they differ
        $event->start_time_raw = date('H:i', strtotime($event->start_datetime));
        $event->end_time_raw   = date('H:i', strtotime($event->end_datetime));
        $event->flyer_url      = $event->website_url;

        wp_send_json_success($event);
    } else {
        wp_send_json_error('Event not found');
    }
}

// We hook into 'save_post_fsbhoa_event' or a custom action
add_action('fsbhoa_event_updated', function($event_id) {
    $repo = new Repository();
    $compiler = new Compiler();
    
    // 1. Get all active events for the next 12 months
    // 2. Compile them to the flat array
    // 3. Write to the JSON file in /wp-content/uploads/
    
    // For now, let's just trigger a log to prove it works on your Pi
    error_log("FSBHOA Calendar: Event $event_id changed. Re-baking JSON...");
    $compiler->bake();
});

// Listen for the AJAX call from the JS "Save Changes" button
add_action('wp_ajax_fsb_save_calendar_event', 'fsb_handle_save_event');

function fsb_handle_save_event() {
    // 1. Security & Permission Check
    check_ajax_referer('fsb_cal_nonce', 'nonce');

    if (!current_user_can('edit_posts')) {
        wp_send_json_error('You do not have permission to edit events.');
    }

    global $wpdb;
    $repo = new \FSBHOA\Cal\Repository();
    $compiler = new \FSBHOA\Cal\Compiler();

    $title = sanitize_text_field($_POST['title'] ?? '');

    // --- MANUAL BAKE TRIGGER ---
    // If title is empty, just bake and exit.
    if (empty($title)) {
        $compiler->bake();
        wp_send_json_success(['message' => 'Manual Bake Complete! No record created.']);
        wp_die();
    }

    // 2. Collect and Sanitize Data
    $event_id   = isset($_POST['event_id']) ? intval($_POST['event_id']) : null;
    $edit_mode  = sanitize_text_field($_POST['edit_mode'] ?? 'single');
    $event_date = sanitize_text_field($_POST['date']);
    $start_time = sanitize_text_field($_POST['start_time']);
    $end_time   = sanitize_text_field($_POST['end_time']);
    //
    // 1. Fetch the existing record to see its original "Anchor Date"
    $existing_event = $event_id ? $repo->get($event_id) : null;

    // 2. Decide which date to use
    // If it's a Master event (no parent_id), keep its original date.
    // This prevents the "Dance Fitness" series from moving to today's date.
    $target_date = $event_date;
    // ONLY protect the master date if we are doing a standard 'single' edit.
    // If we are punching a hole (instance_cancel) or moving (instance_move),
    // we MUST use the new $event_date provided by the calendar cell.
    if ($existing_event && empty($existing_event->parent_id) && $edit_mode === 'single') {
        $target_date = date('Y-m-d', strtotime($existing_event->start_datetime));
    }

    // Standard data payload used for most operations
    $data = [
        'title'          => $title,
        'content'        => wp_kses_post($_POST['content'] ?? ''),
        'start_datetime' => "$target_date $start_time:00",
        'end_datetime'   => "$target_date $end_time:00",
        'location_id'    => !empty($_POST['location_id']) ? intval($_POST['location_id']) : null,
        'category_id'    => !empty($_POST['category_id']) ? intval($_POST['category_id']) : null,
        'is_ticketed'    => isset($_POST['is_ticketed']) && $_POST['is_ticketed'] === 'true' ? 1 : 0,
        'cost'           => sanitize_text_field($_POST['cost']),
        'website_url'    => esc_url_raw($_POST['flyer_url'] ?? ''),
        'rrule'          => !empty($_POST['rrule']) ? sanitize_text_field($_POST['rrule']) : null,
        'visibility'     => 'resident',
        'status'         => 'active'
    ];

    try {
        switch ($edit_mode) {
            case 'instance_cancel':
                // "Punch a hole" in a repeating series
                $data['parent_id'] = $event_id;
                $data['status']    = 'cancelled';
                $data['rrule']     = null; // Children never repeat
                unset($data['id']);
                $repo->save($data);
                break;

            case 'master_cancel':
                // Kill the entire series or the one-shot
                $wpdb->update(
                    $wpdb->prefix . 'fsbhoa_events',
                    ['status' => 'cancelled'],
                    ['id' => $event_id]
                );
                break;

            case 'series_end':
                // Stop the series before this date
                $existing = $repo->get($event_id);
                if ($existing && !empty($existing->rrule)) {
                    // Calculate yesterday's date for the UNTIL rule
                    $until_date = date('Ymd\T235959\Z', strtotime($event_date . ' -1 day'));
        
                    // Strip any existing UNTIL or COUNT and append the new one
                    $base_rule = preg_replace('/;(UNTIL|COUNT)=[^;]+/', '', $existing->rrule);
                    $new_rrule = $base_rule . ";UNTIL=$until_date";
        
                    $wpdb->update($wpdb->prefix . 'fsbhoa_events', ['rrule' => $new_rrule], ['id' => $event_id]);
                }
                break;

            case 'master_delete':
                // The Nuclear Option
                $wpdb->delete($wpdb->prefix . 'fsbhoa_events', ['id' => $event_id]);
                $wpdb->delete($wpdb->prefix . 'fsbhoa_events', ['parent_id' => $event_id]);
                break;

            case 'master_cancel':
                // Fallback for one-shots
                $wpdb->delete($wpdb->prefix . 'fsbhoa_events', ['id' => $event_id]);
                break;

            case 'instance_move':
                // 1. Create the Cancelled Hole for the original date
                $hole = $data;
                $hole['parent_id'] = $event_id;
                $hole['status']    = 'cancelled';
                $hole['rrule']     = null;
                unset($hole['id']);
                $repo->save($hole);

                // 2. Create a new One-Shot for the new date
                $move_to_date = sanitize_text_field($_POST['move_to_date']);
                $data['start_datetime'] = "$move_to_date $start_time:00";
                $data['end_datetime']   = "$move_to_date $end_time:00";
                $data['rrule']          = null; // The moved instance becomes a one-shot
                unset($data['id']);
                $repo->save($data);
                break;

            default:
                // Standard Save or Master Update
                if ($event_id) {
                    $data['id'] = $event_id;
                } else {
                    $data['owner_email'] = wp_get_current_user()->user_email;
                }
                $repo->save($data);
                break;
        }

        // 3. THE BAKE: Refresh the JSON file
        $compiler->bake();
        update_option('fsb_cal_version', time());
        wp_send_json_success(['message' => 'Success! Calendar baked.', 'mode' => $edit_mode]);

    } catch (\Exception $e) {
        wp_send_json_error('Database error: ' . $e->getMessage());
    }

    wp_die();
}


function fsb_handle_bg_upload($file_input_name, $month_index) {
    if (empty($_FILES[$file_input_name]['name'])) return;

    $upload_dir = wp_upload_dir();
    $target_dir = $upload_dir['basedir'] . '/fsbhoa-calendar';

    // Ensure directory exists
    if (!file_exists($target_dir)) {
        wp_mkdir_p($target_dir);
    }

    $file_ext = pathinfo($_FILES[$file_input_name]['name'], PATHINFO_EXTENSION);
    $filename = "cal-bg-month-{$month_index}.{$file_ext}";
    $target_file = $target_dir . '/' . $filename;

    if (move_uploaded_file($_FILES[$file_input_name]['tmp_id'], $target_file)) {
        // Return the URL for storage in options
        return $upload_dir['baseurl'] . '/fsbhoa-calendar/' . $filename;
    }
    return false;
}


// Standard WP AJAX endpoint (Works for logged-in and logged-out users)
add_action('wp_ajax_fsb_get_calendar_json', 'fsb_serve_calendar_json');
add_action('wp_ajax_nopriv_fsb_get_calendar_json', 'fsb_serve_calendar_json');

function fsb_serve_calendar_json() {
    // 1. Get the physical path from your options
    $path = get_option('fsb_cal_json_path');

    // 2. Safety: If DB is empty, use the default
    if (empty($path)) {
        $upload_dir = wp_upload_dir();
        $path = $upload_dir['basedir'] . '/fsbhoa-calendar/calendar-events.json';
    }

    // 3. Check if the file actually exists on the Pi
    if (!file_exists($path)) {
        wp_send_json_error('Calendar data file not found on server.', 404);
    }

    // 4. Set headers so the browser treats this as a JSON file
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *'); // Good for cross-domain if needed

    // 5. Read the file and spit it out
    echo file_get_contents($path);
    exit;
}

