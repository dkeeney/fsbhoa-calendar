<?php
/**
 * Plugin Name: FSBHOA Calendar
 * Plugin URI:        https://github.com/dkeeney/fsbhoa-calendar
 * Description:       The complete website calendar talored for an HOA.
 * Version:           1.0.6
 * Author:            David Keeney
 * Company:           Four Seasons at Bakersfield, (fsbhoa.com)
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author URI:        https://github.com/dkeeney
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       fsbhoa-calendar
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
    //error_log("FSB CALENDAR: wp_enqueue_scripts() running");

    // Only load if the shortcode is present
    if (!is_a(get_post(), 'WP_Post') || !has_shortcode(get_post()->post_content, 'fsbhoa_calendar')) {
        return;
    }
    fsb_enqueue_calendar_scripts();
});



function fsb_enqueue_calendar_scripts() {
    //error_log("FSB CALENDAR: fsb_enqueue_calender_scripts() called");
    if (current_user_can('manage_options')) {
        wp_enqueue_media();
    }

    wp_enqueue_script(
        'fsb-cal-data',
        plugins_url('assets/js/calendar-data.js', __FILE__),
        array(),
        '1.1',
        true
    );

    wp_enqueue_script(
        'fsb-cal-print',
        plugins_url('assets/js/calendar-print.js', __FILE__),
        array('fsb-cal-data'),
        '1.1',
        true
    );

    wp_enqueue_script(
        'fsb-cal-logic',
        plugins_url('assets/js/calendar-logic.js', __FILE__),
        array('fsb-cal-data','fsb-cal-print'),
        '1.1',
        true
    );


    wp_enqueue_style('fsb-cal-style', plugins_url('assets/css/calendar-style.css', __FILE__));
    wp_enqueue_style('fsb-agenda-style', plugins_url('assets/css/agenda-style.css', __FILE__));
    wp_enqueue_style('fsb-cell-style', plugins_url('assets/css/day-cell-style.css', __FILE__));
    //
    // Fetch data for the JS
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


}

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
    <div id="fsb-monthly-wrapper">
        <div id="fsb-calendar-app" 
            data-json-url="<?php echo esc_url($json_url); ?>" 
            data-user-email="<?php echo esc_attr($user_email); ?>" 
            data-is-admin="<?php echo $is_admin; ?>">

            <button type="button" id="prevMonth" class="nav-arrow prev">&#10094;</button>
            <button type="button" id="nextMonth" class="nav-arrow next">&#10095;</button>

            <div id="calendar-grid" class="calendar-grid"></div>
            <div id="fsb-detail-modal" class="fsb-full-modal">
                <div class="modal-backdrop"></div>
                <div class="modal-window">
                    <button class="modal-close" onclick="closeDetailModal()">&times;</button>
                    <div id="modal-content-area"> </div>
                </div>
            </div>
            <div id="fsb-edit-modal" class="fsb-modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <div id="edit-form-container"></div>
                </div>
            </div>
            <div id="fsb-reschedule-modal" class="fsb-modal">
                <div class="modal-content" style="max-width: 400px;">
                    <span class="close-modal" onclick="closeRescheduleModal()">&times;</span>
                    <div id="reschedule-form-container"></div>
                </div>
            </div>
            <div id="fsb-day-modal" class="fsb-modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <div id="fsb-modal-content"></div>
                </div>
            </div>
        </div>
        <div id="fsb-manage-modal" class="fsb-modal">
            <div class="modal-content" style="max-width: 450px;">
                <span class="close-modal">&times;</span>
                <div id="manage-form-container"></div>
            </div>
        </div>
        <div id="fsb-monthly-toolbar" class="calendar-footer-toolbar">
            <div class="toolbar-left">
                <button type="button" id="jumpToday" class="fsb-mini-btn">Today</button>
                <button type="button" id="toggleFullScreen" class="fsb-mini-btn">⛶ Fullscreen</button>
            </div>
    
            <div class="toolbar-right">
                <button type="button" id="printCal" class="fsb-mini-btn">Print (PDF)</button>
                <label class="mini-label">
                    <input type="checkbox" id="toggle-magnifier" checked> Magnifier
                </label>
                <div class="view-toggle-container">
                    <span class="toggle-label">Monthly</span>
                    <label class="fsb-switch">
                        <input type="checkbox" id="viewToggle">
                        <span class="slider round"></span>
                    </label>
                    <span class="toggle-label">Agenda</span>
                </div>
            </div>
        </div>
    </div>


    <?php
    return ob_get_clean();
});

// Add the new Agenda-specific shortcode
add_shortcode('fsbhoa_agenda', function() {
    $json_url = admin_url('admin-ajax.php') . '?action=fsb_get_calendar_json';
    $json_url .= '&v=' . get_option('fsb_cal_version', time());

    $current_user = wp_get_current_user();
    $user_email = $current_user->user_email;
    $is_admin = current_user_can('manage_options') ? 'true' : 'false';

    ob_start();
    ?>
    <div id="fsb-agenda-wrapper">
        <div id="fsb-agenda-app" 
             class="agenda-mode-only"
             data-json-url="<?php echo esc_url($json_url); ?>" 
             data-user-email="<?php echo esc_attr($user_email); ?>" 
             data-is-admin="<?php echo $is_admin; ?>">
            
            <button type="button" id="prevMonth" class="nav-arrow prev">&#10094;</button>
            <button type="button" id="nextMonth" class="nav-arrow next">&#10095;</button>

            <div id="agenda-view">
                <div id="agenda-sticky-header"></div>
                <div id="agenda-content-area"></div>
            </div>

            <div id="fsb-detail-modal" class="fsb-full-modal">
                <div class="modal-backdrop"></div>
                <div class="modal-window">
                    <button class="modal-close" onclick="closeDetailModal()">&times;</button>
                    <div id="modal-content-area"></div>
                </div>
            </div>
        </div>
        <div id="fsb-agenda-toolbar" class="calendar-footer-toolbar">
            <div class="toolbar-left">
                <button type="button" id="jumpToday" class="fsb-mini-btn">Today</button>
            </div>
            <div class="toolbar-right">
                <div class="view-toggle-container">
                    <span class="toggle-label">Monthly</span>
                    <label class="fsb-switch">
                        <input type="checkbox" id="viewToggle">
                        <span class="slider round"></span>
                    </label>
                    <span class="toggle-label">Agenda</span>
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
    $tz = get_option('timezone_string') ?: timezone_name_from_abbr('', get_option('gmt_offset') * 3600, false);
    if ($tz) date_default_timezone_set($tz);

    check_ajax_referer('fsb_cal_nonce', 'nonce');

    $event_id = isset($_GET['event_id']) ? intval($_GET['event_id']) : 0;
    if (!$event_id) wp_send_json_error('Invalid ID');

    $repo = new \FSBHOA\Cal\Repository();
    $event = $repo->get($event_id); // This uses your JOINed get() method

    if ($event) {
        // Map DB fields to JS-friendly keys if they differ
        $event->start_time = date('H:i', strtotime($event->start_datetime));
        $event->end_time   = date('H:i', strtotime($event->end_datetime));
        $event->base_date  = date('Y-m-d', strtotime($event->start_datetime));

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
    $tz = get_option('timezone_string') ?: timezone_name_from_abbr('', get_option('gmt_offset') * 3600, false);
    if ($tz) date_default_timezone_set($tz);

    $edit_mode  = sanitize_text_field($_POST['edit_mode'] ?? 'single');
    $master_id   = isset($_POST['event_id']) ? intval($_POST['event_id']) : null;
    $pivot_id   = isset($_POST['pivot_id']) ? intval($_POST['pivot_id']) : $master_id;
    $move_id   = isset($_POST['move_id']) ? intval($_POST['move_id']) : null;

    error_log("FSBHOA AJAX TRIGGERED: Mode=" . $edit_mode . 
              " ID=$master_id move_id=$move_id pivot_id=$pivot_id");

    
    // 1. Security & Permission Check
    check_ajax_referer('fsb_cal_nonce', 'nonce');
    error_log("PHP DEBUG: Nonce Check Passed");

    if (!current_user_can('edit_posts')) {
        error_log("PHP DEBUG: Permission Denied for user");
        wp_send_json_error('You do not have permission to edit events.');
    }

    global $wpdb;
    $repo = new \FSBHOA\Cal\Repository();
    $compiler = new \FSBHOA\Cal\Compiler();



    // 2. Collect and Sanitize Data
    $title      = sanitize_text_field($_POST['title'] ?? '');
    $event_date = sanitize_text_field($_POST['date']);  // date clicked on
    //
    // 1. Fetch the existing master record to see its original "Anchor Date"
    $existing_event = $master_id ? $repo->get($master_id) : null;


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

    try {
        switch ($edit_mode) {
            case 'instance_cancel':
                error_log("PHP DEBUG: Entering instance_cancel for ID: " . $master_id);
                // "Punch a hole" in a repeating series
                $dna_start_time = substr($existing_event->start_datetime, 11, 8);
                $dna_end_time   = substr($existing_event->end_datetime, 11, 8);
                $data = [
                    'title'          => $existing_event->title,
                    'parent_id'      => $master_id,
                    'start_datetime' => "$target_date $dna_start_time",
                    'end_datetime'   => "$target_date $dna_end_time",
                    'status'         => 'cancelled',
                    'rrule'          => null // Children never repeat
                ];
                $repo->save($data);
                break;

            case 'master_cancel':
                // Kill the entire series or the one-shot
                $wpdb->update(
                    $wpdb->prefix . 'fsbhoa_events',
                    ['status' => 'cancelled'],
                    ['id' => $master_id]
                );
                break;

            case 'instance_restore':
               // $target_date is the date of the cell clicked.
               // We look for the first record >= that date that is 'cancelled'.
               $hole_to_remove = $wpdb->get_var($wpdb->prepare(
                   "SELECT id FROM {$wpdb->prefix}fsbhoa_events
                    WHERE parent_id = %d
                    AND status = 'cancelled'
                    AND start_datetime >= %s
                    ORDER BY start_datetime ASC
                    LIMIT 1",
                   $master_id,
                   $target_date . ' 00:00:00'
               ));

               if ($hole_to_remove) {
                   $wpdb->delete($wpdb->prefix . 'fsbhoa_events', ['id' => $hole_to_remove]);
                   error_log("FSBHOA REPO: Undeleted instance. Removed hole ID: $hole_to_remove");
               } else {
                   error_log("FSBHOA REPO: No future holes found to undelete for Master ID: $master_id");
               }
               break;

            case 'series_end':
                // Stop the series before this date
                $existing_pivot = $repo->get($pivot_id);
                if ($existing_pivot && !empty($existing_pivot->rrule)) {
                    // REMOVE THE 'Z': Use local time to match your DTSTART format
                    $until_date = date('Ymd\T235959', strtotime($event_date . ' -1 day'));

                    $clean = str_ireplace('RRULE:', '', trim($existing_pivot->rrule));
                    $clean = preg_replace('/;(UNTIL|COUNT)=[^;]+/', '', $clean);
                    $clean = rtrim($clean, ';');

                    $new_rrule = $clean . ";UNTIL=$until_date";

                    $wpdb->update($wpdb->prefix . 'fsbhoa_events',
                        ['rrule' => $new_rrule],
                        ['id' => $pivot_id]
                    );
                    error_log("FSBHOA REPO: Series ended (Local Time): $new_rrule");
                }
                break;

            case 'master_delete':
                // The Nuclear Option
                $wpdb->delete($wpdb->prefix . 'fsbhoa_events', ['id' => $master_id]);
                $wpdb->delete($wpdb->prefix . 'fsbhoa_events', ['parent_id' => $master_id]);
                break;

            case 'instance_move':
                $event_date   = sanitize_text_field($_POST['date']);
                $move_to_date = sanitize_text_field($_POST['move_to_date']);
                $new_start    = sanitize_text_field($_POST['move_to_start_time']);
                $scope        = sanitize_text_field($_POST['reschedule_scope'] ?? 'instance');

                error_log("FSBHOA DEBUG: Entering move logic for ID $master_id, pivot_id: $pivot_id, move_id: $move_id");

                // Calculate end time based on the original duration
                $existing_pivot = $repo->get($pivot_id);   // pivot or master
                if (!$existing_pivot) {
                    error_log("FSBHOA DEBUG: active pivot $pivot_id not found");
                    wp_send_json_error('Event not found');
                }
                $duration_seconds = strtotime($existing_pivot->end_datetime) - strtotime($existing_pivot->start_datetime);
                $new_end = date('H:i', strtotime($new_start) + $duration_seconds);

                $result = $repo->move_event_instance(
                    $master_id,
                    $pivot_id,   // id of pivot or master
                    $move_id,    // if moving from a move record or null
                    $event_date, // The date from the calendar cell
                    $move_to_date,
                    $new_start,
                    $new_end,
                    $scope
                );

                if (is_wp_error($result)) {
                    error_log("FSBHOA DEBUG: Repo error: " . $result->get_error_message());
                    wp_send_json_error($result->get_error_message());
                }
                error_log("FSBHOA DEBUG: Move call finished successfully");
                break;


            case 'series_resume':
                // 1. Remove the UNTIL clause from the Pivot/Master
                $existing_pivot = $repo->get($pivot_id);
                if ($existing_pivot && !empty($existing_pivot->rrule)) {
                    // Strip UNTIL and COUNT to make it infinite again
                    $new_rrule = preg_replace('/;(UNTIL|COUNT)=[^;]+/', '', $existing_pivot->rrule);
                    $wpdb->update($wpdb->prefix . 'fsbhoa_events',
                        ['rrule' => $new_rrule],
                        ['id' => $pivot_id]
                    );
                    error_log("FSBHOA REPO: Series resumed. RRule updated for ID: $pivot_id");
                }

                // 2. Clean up all future holes/cancellations for this lineage
                // We target anything >= today's date that is marked 'cancelled'
                $wpdb->query($wpdb->prepare(
                    "DELETE FROM {$wpdb->prefix}fsbhoa_events
                     WHERE parent_id = %d
                     AND status = 'cancelled'
                     AND start_datetime >= %s",
                    $master_id,
                    $target_date . ' 00:00:00'
                ));
                error_log("FSBHOA REPO: Future holes cleared for master: $master_id starting $target_date");
                break;


            default:
                // GUARDRAIL: make sure there is a title.
                // If there is no title, assume we just want to do a bake.
                if (empty($title)) {
                    error_log("FSBHOA DEBUG: title empty, just doing a bake.");
                    break;
                }

                error_log("FSBHOA DEBUG: taking default case.");

                // Standard data payload used add/edit.
                $start_time = sanitize_text_field($_POST['start_time']); 
                $end_time   = sanitize_text_field($_POST['end_time']);
                $data = [
                    'title'          => $title,
                    'content'        => wp_kses_post($_POST['content'] ?? ''),
                    'setup_notes'    => wp_kses_post($_POST['setup_notes'] ?? ''),
                    'location_id'    => !empty($_POST['location_id']) ? intval($_POST['location_id']) : null,
                    'category_id'    => !empty($_POST['category_id']) ? intval($_POST['category_id']) : null,
                    'is_ticketed'    => isset($_POST['is_ticketed']) && $_POST['is_ticketed'] === 'true' ? 1 : 0,
                    'cost'           => sanitize_text_field($_POST['cost']),
                    'flyer_url'      => esc_url_raw($_POST['flyer_url'] ?? ''),
                    'visibility'     => isset($_POST['visibility']) ? sanitize_text_field($_POST['visibility']) : 'public',
                    'status'         => 'active',
                    'owner_email'    => isset($_POST['owner_email']) ? sanitize_email($_POST['owner_email']) : null,
                ];

                if ($edit_mode == 'soft_save') {
                    // Just update the metadata on the Master record
                    $data['id'] = $master_id;
                    $repo->save($data);
                    // Note: We EXPLICITLY do not call fsb_maybe_pivot_series here.
                    break;
                }

                $new_rrule = !empty($_POST['rrule']) ? sanitize_text_field($_POST['rrule']) : null;
                $new_start_datetime = "$target_date $start_time:00";
                $new_end_datetime   = "$target_date $end_time:00";

                if (!$master_id) {
                    // this is an Add
                    error_log("FSBHOA Doing a master add");
                    $data['rrule']          = $new_rrule;
                    $data['start_datetime'] = $new_start_datetime;
                    $data['end_datetime']   = $new_end_datetime;
                    $repo->save($data);

                } else {
                    // this is an update
                    error_log("FSBHOA Doing an update on $pivot_id.");
                    $data['id'] = $master_id;
                    $repo->save($data);

                    //  Check for a Series Pivot
                    $data = [];
                    $data['title']          = $title;   // for debugging
                    $data['rrule']          = $new_rrule;
                    $data['start_datetime'] = $new_start_datetime;
                    $data['end_datetime']   = $new_end_datetime;
                    fsb_maybe_pivot_series($repo, $pivot_id, $data, $target_date);
                }
                break;
        }

        // 3. THE BAKE: Refresh the JSON file
        $compiler->bake();
        update_option('fsb_cal_version', time());
        wp_send_json_success(['message' => 'Success! Calendar baked.', 'mode' => $edit_mode]);

    } catch (\Exception $e) {
        error_log("FSBHOA CRITICAL ERROR: in save logic. " . $e->getMessage());
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
function fsb_maybe_pivot_series($repo, $pivot_id, $dna_data, $clicked_date) {
    $active_rule = $repo->get($pivot_id);
    if (!$active_rule) {
        error_log("FSBHOA PIVOT: Could not find Pivot record $pivot_id");
        return; // Should not happen if Master exists
    }
    $master_id = !empty($active_rule->parent_id) ? $active_rule->parent_id : $active_rule->id;

    $today_str = date('Y-m-d');

    $pivot_date = $clicked_date;


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
        error_log("FSBHOA PIVOT: No DNA change detected. Skipping.");
        return;
    }
    
    error_log("FSBHOA PIVOT check: DNA changed id=$pivot_id");

    // --- 4. DECIDE: UPDATE IN-PLACE OR INSERT NEW PIVOT ---
    $rule_start_date = date('Y-m-d', strtotime($active_rule->start_datetime));

    if ($rule_start_date === $pivot_date) {
        // CASE: Update In-Place
        // The user is editing a rule that starts exactly on the pivot date.
        error_log("FSBHOA PIVOT: Updating existing record ID {$active_rule->id} in-place.");

        // update pivot record (or master)
        $repo->save([
            'id'             => $active_rule->id,
            'rrule'          => $dna_data['rrule'],
            'start_datetime' => "$pivot_date $new_start_time:00",
            'end_datetime'   => "$pivot_date $new_end_time:00"
        ]);

        // Nuke all downstream children of the master for this era
        $repo->delete_downstream($master_id, $pivot_date, $old_start_time_full);
    } else {
        // CASE: Create New Pivot
        // We are branching off from an older rule.
        error_log("FSBHOA PIVOT: Creating new pivot era starting $pivot_date.");

        // 1. Nuke downstream first to clear the path
        $repo->delete_downstream($master_id, $pivot_date, $old_start_time_full);

        // 2. Insert the new Pivot
        $repo->save([
            'parent_id'      => $master_id,
            'title'          => $dna_data['title'] ?? '',
            'rrule'          => $dna_data['rrule'],
            'start_datetime' => "$pivot_date $new_start_time:00",
            'end_datetime'   => "$pivot_date $new_end_time:00",
            'status'         => 'active'
        ]);
    }
}
