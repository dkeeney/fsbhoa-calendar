<?php
/**
 * Plugin Name: FSBHOA Calendar
 * Plugin URI:        https://github.com/dkeeney/fsbhoa-calendar
 * Description:       The complete website calendar talored for an HOA.
 * Version:           1.1.0
 * Author:            David Keeney
 * AI Tool:           Gemini Pro 2.5 and 3.1
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


// --- SANDBOX BRIDGE HELPERS ---
function fsb_get_repo() {
    global $wpdb;
    // If the Playwright cookie is present, use the test prefix!
    if (isset($_COOKIE['fsb_test_mode']) && $_COOKIE['fsb_test_mode'] === '1') {
        return new \FSBHOA\Cal\Repository($wpdb->prefix . 'test_');
    }
    return new \FSBHOA\Cal\Repository();
}

function fsb_get_compiler() {
    global $wpdb;
    // If the Playwright cookie is present, use test prefix AND test JSON path!
    if (isset($_COOKIE['fsb_test_mode']) && $_COOKIE['fsb_test_mode'] === '1') {
        $upload_dir = wp_upload_dir();
        $test_json_path = $upload_dir['basedir'] . '/fsbhoa-calendar/test_calendar-events.json';
        return new \FSBHOA\Cal\Compiler($wpdb->prefix . 'test_', $test_json_path);
    }
    return new \FSBHOA\Cal\Compiler();
}
// ------------------------------

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


add_action('admin_enqueue_scripts', function($hook) {
    // Only load on our settings page to keep admin clean
    if ($hook !== 'toplevel_page_fsb-cal-settings') return;

    // Load the CSS
    wp_enqueue_style('fsb-cal-style', plugins_url('assets/css/calendar-style.css', __FILE__));
    wp_enqueue_style('fsb-cell-style', plugins_url('assets/css/day-cell-style.css', __FILE__));

    // Enqueue the same scripts used for the front-end
    fsb_enqueue_calendar_scripts();

    // Force a specific Admin fix for the scrollbar and modal layering
    wp_add_inline_style('fsb-cal-style', "
        /* Prevent the modal from being hidden behind the WP Admin Menu */
        .fsb-modal {
            z-index: 99999 !important;
        }
        /* Override any 'overflow: hidden' that might get stuck on the admin body */
        body.fsb-admin-scroll-fix {
            overflow: auto !important;
            height: auto !important;
        }
    ");
});

add_action('wp_enqueue_scripts', function() {
    // Let the shortcode handle script loading directly on demand
    // to protect page speed everywhere else across the site hierarchy.
});



function fsb_enqueue_calendar_scripts() {
    //error_log("FSB CALENDAR: fsb_enqueue_calender_scripts() called");
    $ver = '1.1';
    $current_user = wp_get_current_user();
    $user_email = !empty($current_user->user_email) ? $current_user->user_email : '';


    wp_enqueue_script(
        'fsb-cal-data',
        plugins_url('assets/js/calendar-data.js', __FILE__),
        array(),
        $ver,
        true
    );


    // Load the View logic
    wp_enqueue_script(
        'fsb-cal-view', 
        plugins_url('assets/js/calendar-view.js', __FILE__), 
        array('fsb-cal-data'), 
        $ver, 
        true
    );
    // Note: calendar-print.js is not loaded until used.


    $repo = fsb_get_repo();
    $is_admin = current_user_can('manage_options');

    // Quick check: Is this user an owner of ANY event?
    $is_delegate = false;
    if ( is_user_logged_in() && !$is_admin && !empty($user_email) ) {
        $is_delegate = $repo->is_user_delegate($user_email);
    }


    if ( $is_admin || $is_delegate) {
        wp_enqueue_media();

        // Load the Editor logic (For this pass, load for everyone to test the split)
        wp_enqueue_script(
            'fsb-cal-editor', 
            plugins_url('assets/js/calendar-editor.js', __FILE__), 
            array('fsb-cal-view'), 
            $ver, 
            true
        );
    }


    wp_enqueue_style('fsb-cal-style', plugins_url('assets/css/calendar-style.css', __FILE__));
    wp_enqueue_style('fsb-agenda-style', plugins_url('assets/css/agenda-style.css', __FILE__));
    wp_enqueue_style('fsb-cell-style', plugins_url('assets/css/day-cell-style.css', __FILE__));
    
    // Fetch data for the JS
    $locations = $repo->get_locations();
    $categories = $repo->get_categories();
    $upload_dir = wp_upload_dir();

    // 3. Localize ONE TIME with all data
    wp_localize_script('fsb-cal-view', 'fsb_config', array(
        'ajax_url'      => admin_url('admin-ajax.php'),
        'nonce'         => wp_create_nonce('fsb_cal_nonce'),
        'print_js_url'  => plugins_url('assets/js/calendar-print.js', __FILE__),
        'bg_base_url'   => $upload_dir['baseurl'] . '/fsbhoa-calendar/backgrounds/',
        'past_limit'    => (int)get_option('fsb_cal_past_months', 1),
        'future_limit'  => (int)get_option('fsb_cal_future_months', 12),
        'locations'     => $locations,
        'categories'    => $categories,
        'time_position' => get_option('fsb_time_position', 'prepend'),
        'time_format'   => get_option('fsb_time_format', '12hr'),
        'start_day'     => get_option('fsb_start_day', '0'),
        'is_admin'      => $is_admin,
        'user_email'    => $user_email,
        'version'       => time()
    ));


}

// --- THE SHADOW STATE: INTERCEPT OPTIONS FOR SANDBOX ---
//  While running a regression test, use the options from the sandbox.
add_action('init', 'fsb_apply_sandbox_options');
function fsb_apply_sandbox_options() {
    // Only intercept if the browser has the Playwright test cookie
    if (isset($_COOKIE['fsb_test_mode'])) {
        $sandbox_options = get_transient('fsb_sandbox_options') ?: [];

        $allowed_overrides = ['fsb_start_day', 'fsb_time_format', 'fsb_time_position'];

        foreach ($allowed_overrides as $opt) {
            add_filter("pre_option_{$opt}", function($false) use ($opt, $sandbox_options) {
                // If Playwright explicitly set a shadow option, return it!
                if (isset($sandbox_options[$opt])) {
                    return $sandbox_options[$opt];
                }
                // Otherwise, fall through to the real default database option
                return $false;
            });
        }
    }
}

add_action('wp_ajax_fsb_run_regression_step', function() {
    $nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? $_SERVER['HTTP_X_WP_NONCE'] : ($_REQUEST['nonce'] ?? '');
    if ( ! wp_verify_nonce( $nonce, 'fsb_reg_nonce' ) && ! wp_verify_nonce( $nonce, 'fsb_cal_nonce' ) ) {
        wp_send_json_error( 'Invalid Security Nonce' );
        wp_die();
    }

    $step = sanitize_text_field($_GET['step']);
    $runner = new \FSBHOA\Cal\TestRunner();

    switch($step) {
        case 'init':
            // Tell the JS console which tests exist
            $scenarios = $runner->get_test_scenarios();
            wp_send_json_success([
                'message' => 'Sandbox Ready.',
                'scenarios' => $scenarios,
                'prefix' => $runner->get_prefix(),
                'json_url' => $runner->get_json_url()
            ]);
            break;

        case 'set_option':   // Sandbox the options for regression tests
            $allowed_options = ['fsb_start_day', 'fsb_time_format', 'fsb_time_position'];
            $opt_name = sanitize_text_field($_POST['opt_name'] ?? '');
            $opt_val = sanitize_text_field($_POST['opt_val'] ?? '');

            if (in_array($opt_name, $allowed_options)) {
                // Write to a temporary transient, NOT the real wp_options table!
                $sandbox_opts = get_transient('fsb_sandbox_options') ?: [];
                $sandbox_opts[$opt_name] = $opt_val;
                set_transient('fsb_sandbox_options', $sandbox_opts, HOUR_IN_SECONDS);

                wp_send_json_success("Sandbox Shadow Option {$opt_name} set to {$opt_val}");
            } else {
                wp_send_json_error('Invalid option key for sandbox modification.');
            }
            break;

        case 'run_scenario':
            $slug = sanitize_text_field($_GET['slug']);
            // The TestRunner will load the fixture, run the test, and return pass/fail
            $result = $runner->run_test_scenario($slug);

            if ($result['success']) {
                wp_send_json_success(['message' => $result['message']]);
            } else {
                wp_send_json_error($result['message']);
            }
            break;

        case 'load_fixture':
            // Read raw JSON from the POST body
            $json_payload = file_get_contents('php://input');
            $fixture_data = json_decode($json_payload, true);
            
            if (!$fixture_data) wp_send_json_error('Invalid JSON payload');
            
            $mapped_ids = $runner->load_fixture($fixture_data);

            // BUST THE BROWSER CACHE: Playwright executes too fast for standard time()
            update_option('fsb_cal_version', time() . rand(100, 999));
            
            wp_send_json_success([
                'message' => 'Fixture loaded successfully.',
                'ids' => $mapped_ids
            ]);
            break;

        case 'get_db_state':
            $master_id = intval($_GET['master_id'] ?? 0);
            if (!$master_id) wp_send_json_error('Missing master_id');

            $state = $runner->get_db_state($master_id);
            wp_send_json_success(['db_state' => $state]);
            break;

        case 'get_nth_instance':
            // Note: the pivot_id may actually be the master.
            $pivot_id = intval($_GET['pivot_id'] ?? 0);
            $n = intval($_GET['n'] ?? 0); // 0 = first instance

            if (!$pivot_id) wp_send_json_error('Missing pivot_id');

            // Grab the repo using your existing sandbox helper
            $repo = fsb_get_repo();
            $pivot = $repo->get($pivot_id);

            if (!$pivot || empty($pivot->rrule)) {
                wp_send_json_error('Event not found or not recurring');
                break;
            }

            // Sync Timezone
            $tz_string = get_option('timezone_string') ?: timezone_name_from_abbr('', get_option('gmt_offset') * 3600, false);
            if ($tz_string) date_default_timezone_set($tz_string);

            $anchor = new \DateTime($pivot->start_datetime);

            // Clean the RRule string to parse into array
            $clean_rule = trim(str_ireplace('RRULE:', '', $pivot->rrule));
            $parts = [];
            foreach (explode(';', $clean_rule) as $pair) {
                if (strpos($pair, '=') !== false) {
                    list($key, $value) = explode('=', $pair);
                    $parts[trim($key)] = trim($value);
                }
            }
            $parts['DTSTART'] = $anchor;

            try {
                // Pass array to ensure strict 1:1 mapping with the PHP compiler
                $rrule = new \RRule\RRule($parts);

                // Get occurrences inclusive of anchor, limit to N+1
                $occurrences = $rrule->getOccurrencesAfter($anchor, true, $n + 1);

                if (isset($occurrences[$n])) {
                    wp_send_json_success(['date' => $occurrences[$n]->format('Y-m-d')]);
                } else {
                    wp_send_json_error('Instance out of bounds (past UNTIL date or invalid)');
                }
            } catch (\Exception $e) {
                wp_send_json_error('RRule Parse Error: ' . $e->getMessage());
            }
            break;

        case 'cleanup':
            $runner->cleanup();

            delete_transient('fsb_sandbox_options');

            wp_send_json_success();
            break;
    }
});




// the shortcode for the monthly calendar.
add_shortcode('fsbhoa_calendar', function() {
    // FORCE LOAD CALENDAR ASSETS STRICTLY WHEN THIS SHORTCODE IS PRESENT
    fsb_enqueue_calendar_scripts();


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
            <div class="fsb-detail-modal fsb-full-modal">
                <div class="modal-backdrop"></div>
                <div class="modal-window">
                    <button class="modal-close" onclick="closeDetailModal()">&times;</button>
                    <div class="modal-content-area"> </div>
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
    // FORCE LOAD CALENDAR ASSETS FOR AGENDA STREAM LAYOUTS
    fsb_enqueue_calendar_scripts();
    
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
            
              <div class="nav-arrow prev" id="prevMonthAgenda">❮</div>
              <div class="nav-arrow next" id="nextMonthAgenda">❯</div>
              <div class="agenda-controls-wrapper">
                   <div id="agenda-sticky-header" class="agenda-only"></div>
              </div>
              <div id="agenda-view">
                   <div id="agenda-content-area"></div>
              </div>

              <div class="fsb-detail-modal fsb-full-modal">
                   <div class="modal-backdrop"></div>
                   <div class="modal-window">
                        <button class="modal-close" onclick="closeDetailModal()">&times;</button>
                        <div class="modal-content-area"></div>
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
        $compiler = fsb_get_compiler();
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

    $repo = fsb_get_repo();
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
    $compiler = fsb_get_compiler();
    
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

    $edit_mode  = sanitize_text_field($_POST['edit_mode'] ?? 'standard');
    $master_id   = isset($_POST['event_id']) ? intval($_POST['event_id']) : null;
    $pivot_id   = isset($_POST['pivot_id']) ? intval($_POST['pivot_id']) : $master_id;
    $move_id   = isset($_POST['move_id']) ? intval($_POST['move_id']) : null;
    $repo = fsb_get_repo();
    $compiler = fsb_get_compiler();

    error_log("FSBHOA AJAX TRIGGERED: Mode=" . $edit_mode . 
              " ID=$master_id move_id=$move_id pivot_id=$pivot_id");

    
    // 1. Security & Permission Check
    check_ajax_referer('fsb_cal_nonce', 'nonce');
    error_log("PHP DEBUG: Nonce Check Passed");


    // Quick check: Is this admin or user an owner of ANY event?
    $is_admin = current_user_can('manage_options');
    $is_delegate = false;
    if ( is_user_logged_in() && !$is_admin ) {
        $is_delegate = $repo->is_user_delegate($user_email);
    }
    if (!$is_admin && !$is_delegate) {
        error_log("PHP DEBUG: Permission Denied for user");
        wp_send_json_error('You do not have permission to edit events.');
    }




    // 2. Collect and Sanitize Data
    $title      = sanitize_text_field($_POST['title'] ?? '');
    $event_date = sanitize_text_field($_POST['date'] ?? '');  // date clicked on
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
    //if ($existing_event && empty($existing_event->parent_id) && $edit_mode === 'standard') {
    //    $target_date = date('Y-m-d', strtotime($existing_event->start_datetime));
    //}

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
                $repo->cancel_series($master_id);
                break;

            case 'instance_restore':
               // $target_date is the date of the cell clicked.
               // We look for the first record >= that date that is 'cancelled'.
               $repo->restore_hole($master_id, $target_date);
               break;

            case 'series_end':
                // Stop the series before this date
                $until_date = date('Ymd\T235959', strtotime($event_date . ' -1 day'));
                $repo->end_series($pivot_id, $until_date);
                break;

            case 'master_delete':
                // Delete the master and all children.
                $repo->delete_series($master_id);
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
                resume_series($pivot_id, $target_date);
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
                    $repo->maybe_pivot_series($pivot_id, $data, $target_date);
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
    $upload_dir = wp_upload_dir();
    // 1. Check for Sandbox Bridge
    if (isset($_COOKIE['fsb_test_mode']) && $_COOKIE['fsb_test_mode'] === '1') {
        $path = $upload_dir['basedir'] . '/fsbhoa-calendar/test_calendar-events.json';
    } else {
        // Normal live operation
        $path = get_option('fsb_cal_json_path');
        if (empty($path)) {
            $path = $upload_dir['basedir'] . '/fsbhoa-calendar/calendar-events.json';
        }
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

// Allow both logged-in users and guests to export events
add_action('wp_ajax_fsb_export_event', 'fsb_ajax_export_event');
add_action('wp_ajax_nopriv_fsb_export_event', 'fsb_ajax_export_event');

function fsb_ajax_export_event() {
    $event_id = intval($_GET['event_id'] ?? 0);
    if (!$event_id) wp_die('Invalid Event ID');
    $site_domain = wp_parse_url(home_url(), PHP_URL_HOST);

    $repo = fsb_get_repo();
    $target_event = $repo->get($event_id);
    if (!$target_event) wp_die('Event not found');

    // If they clicked a child pivot, we want to export the whole series starting from the Master
    $family_root_id = !empty($target_event->parent_id) ? $target_event->parent_id : $target_event->id;
    
    // 1. Get the Master
    $master_event = $repo->get($family_root_id);
    
    // 2. Get all children (Pivots and single-instance moves)
    global $wpdb;
    $table_name = $repo->get_table_name();
    $family_members = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table_name WHERE parent_id = %d AND status = 'active' ORDER BY start_datetime ASC", 
        $family_root_id
    ));

    // 3. Get all "Holes" (Cancellations) for this family tree
    $exceptions = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table_name WHERE (id = %d OR parent_id = %d) AND status = 'cancelled'", 
        $family_root_id, $family_root_id
    ));

    $now = date('Ymd\THis');
    $ics = [];
    $ics[] = "BEGIN:VCALENDAR";
    $ics[] = "VERSION:2.0";
    $ics[] = "PRODID:-//FSBHOA//Calendar Engine//EN";
    $ics[] = "CALSCALE:GREGORIAN";
    $ics[] = "X-WR-CALNAME:" . escape_ics_text($master_event->title); // Names the subscription

    // Helper function to generate a VEVENT block
    $build_vevent = function($ev) use ($now, $exceptions) {
        $dtstart = date('Ymd\THis', strtotime($ev->start_datetime));
        $dtend   = date('Ymd\THis', strtotime($ev->end_datetime));
        
        $block = [];
        $block[] = "BEGIN:VEVENT";
        // Link all family members to the same core UID so the calendar knows they are related
        $block[] = "UID:fsbhoa-family-{$ev->id}@{$site_domain}";
        $block[] = "DTSTAMP:{$now}";
        $block[] = "DTSTART:{$dtstart}";
        $block[] = "DTEND:{$dtend}";
        $block[] = "SUMMARY:" . escape_ics_text($ev->title);
        
        if (!empty($ev->location)) {
            $block[] = "LOCATION:" . escape_ics_text($ev->location);
        }
        if (!empty($ev->description)) {
            $block[] = "DESCRIPTION:" . escape_ics_text(wp_strip_all_tags($ev->description));
        }

        // Add the RRule
        if (!empty($ev->rrule)) {
            $clean_rule = trim(str_ireplace('RRULE:', '', $ev->rrule));
            $block[] = "RRULE:{$clean_rule}";
        }

        // Add EXDATEs (Holes) that belong to this specific era
        foreach ($exceptions as $ex) {
            $ex_target = !empty($ex->parent_id) ? $ex->parent_id : $ex->id;
            if ($ex_target == $ev->id) {
                // EXDATE format: YYYYMMDDTHHMMSS
                $ex_date = date('Ymd\THis', strtotime($ex->start_datetime));
                $block[] = "EXDATE:{$ex_date}";
            }
        }

        $block[] = "END:VEVENT";
        return $block;
    };

    // --- RENDER THE FAMILY TREE ---
    
    // Output the Master
    $ics = array_merge($ics, $build_vevent($master_event));

    // Output all Child Pivots
    if (!empty($family_members)) {
        foreach ($family_members as $child) {
            $ics = array_merge($ics, $build_vevent($child));
        }
    }

    $ics[] = "END:VCALENDAR";

    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="fsbhoa-events.ics"');
    
    // iCalendar spec requires CRLF line endings
    echo implode("\r\n", $ics);
    exit;
}

function escape_ics_text($string) {
    $string = str_replace(array('\\', ',', ';', "\n"), array('\\\\', '\,', '\;', '\\n'), $string);
    return $string;
}


