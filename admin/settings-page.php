<?php

if ( ! defined( 'ABSPATH' ) ) exit;

add_action('admin_menu', function() {
    add_menu_page(
        'FSBHOA Calendar',
        'FSBHOA Calendar',
        'manage_options',
        'fsb-cal-settings',
        'fsb_render_settings_tabs',
        'dashicons-calendar-alt'
    );
});

add_action('admin_init', function() {
    register_setting('fsb_cal_settings_group', 'fsb_cal_past_months');
    register_setting('fsb_cal_settings_group', 'fsb_cal_future_months');
    register_setting('fsb_cal_settings_group', 'fsb_time_position');
    register_setting('fsb_cal_settings_group', 'fsb_cal_json_path');
});

// Ensure scripts and modal styles are loaded for the settings page
add_action('admin_enqueue_scripts', function($hook) {
    if ($hook !== 'toplevel_page_fsb-cal-settings') return;

    // Load the main plugin enqueuer
    if (function_exists('fsb_enqueue_calendar_scripts')) {
        fsb_enqueue_calendar_scripts();
    }

    // Force Admin-specific overrides for modals and scrolling
    wp_add_inline_style('fsb-cal-style', "
        .fsb-modal { z-index: 99999 !important; display: none; position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); }
        .fsb-modal.is-visible { display: flex !important; align-items: center; justify-content: center; }
        body.fsb-admin-scroll-fix { overflow: auto !important; height: auto !important; }
    ");
});

function fsb_render_settings_tabs() {
    $active_tab = isset($_GET['tab']) ? $_GET['tab'] : 'settings';
    ?>
    <div class="wrap">
        <h1>FSBHOA Calendar Configuration</h1>
        <h2 class="nav-tab-wrapper">
            <a href="?page=fsb-cal-settings&tab=settings" class="nav-tab <?php echo $active_tab == 'settings' ? 'nav-tab-active' : ''; ?>">Settings</a>
            <a href="?page=fsb-cal-settings&tab=backgrounds" class="nav-tab <?php echo $active_tab == 'backgrounds' ? 'nav-tab-active' : ''; ?>">Monthly Backgrounds</a>
            <a href="?page=fsb-cal-settings&tab=locations" class="nav-tab <?php echo $active_tab == 'locations' ? 'nav-tab-active' : ''; ?>">Locations</a>
            <a href="?page=fsb-cal-settings&tab=categories" class="nav-tab <?php echo $active_tab == 'categories' ? 'nav-tab-active' : ''; ?>">Categories</a>
            <a href="?page=fsb-cal-settings&tab=audit" class="nav-tab <?php echo $active_tab == 'audit' ? 'nav-tab-active' : ''; ?>">Event Audit Log</a>
        </h2>

        <div style="margin-top: 20px;">
            <?php
            switch($active_tab) {
                case 'settings':   fsb_render_settings_manager(); break;
                case 'locations':  fsb_render_location_manager(); break;
                case 'categories': fsb_render_category_manager(); break;
                case 'audit':      fsb_render_event_audit(); break;
                default:           fsb_render_bg_manager(); break;
            }
            ?>
        </div>
    </div>
    <?php
}

function fsb_render_settings_manager() {
    $past_val    = get_option('fsb_cal_past_months', 1);
    $future_val  = get_option('fsb_cal_future_months', 12);
    $time_pos    = get_option('fsb_time_position', 'prepend');
    $json_path   = get_option('fsb_cal_json_path');
    ?>
    <div class="wrap">
        <form method="post" action="options.php">
            <?php
                settings_fields('fsb_cal_settings_group');
                do_settings_sections('fsb_cal_settings_group');
            ?>
            <div style="background:#fff; padding:20px; border:1px solid #ccc; margin-top:20px; border-radius:4px;">
                <h3 style="margin-top:0;">Baking & Data Configuration</h3>
                <table class="form-table">
                    <tr>
                        <th scope="row">Past Months:</th>
                        <td><input type="number" name="fsb_cal_past_months" value="<?php echo esc_attr($past_val); ?>" style="width:70px;"></td>
                    </tr>
                    <tr>
                        <th scope="row">Future Months:</th>
                        <td><input type="number" name="fsb_cal_future_months" value="<?php echo esc_attr($future_val); ?>" style="width:70px;"></td>
                    </tr>
                    <tr>
                        <th scope="row">JSON Storage Path:</th>
                        <td>
                            <input type="text" name="fsb_cal_json_path" value="<?php echo esc_attr($json_path); ?>" class="large-text" style="font-family:monospace;">
                        </td>
                    </tr>
                </table>
            </div>
            <div style="background:#fff; padding:20px; border:1px solid #ccc; margin-top:20px; border-radius:4px;">
                <h3>Display Preferences</h3>
                <table class="form-table">
                    <tr>
                        <th scope="row">Time Placement:</th>
                        <td>
                            <select name="fsb_time_position">
                                <option value="prepend" <?php selected($time_pos, 'prepend'); ?>>Time First</option>
                                <option value="append" <?php selected($time_pos, 'append'); ?>>Title First</option>
                                <option value="hidden" <?php selected($time_pos, 'hidden'); ?>>Hide Time</option>
                            </select>
                        </td>
                    </tr>
                </table>
            </div>
            <?php submit_button('Save All Settings & Re-Bake'); ?>
        </form>
    </div>
    <?php
}

function fsb_render_bg_manager() {
    if (isset($_POST['fsb_upload_zip'])) {
        fsb_handle_zip_upload();
    }
    $upload_dir = wp_upload_dir();
    $bg_url_base = $upload_dir['baseurl'] . '/fsbhoa-calendar/backgrounds/';
    $bg_path_base = $upload_dir['basedir'] . '/fsbhoa-calendar/backgrounds/';
    ?>
    <h3>Monthly Backgrounds (ZIP Upload)</h3>
    <form method="post" enctype="multipart/form-data" style="background:#fff; padding:20px; border:1px solid #ccc; display:inline-block;">
        <input type="file" name="cal_zip" accept=".zip" required>
        <input type="submit" name="fsb_upload_zip" class="button-primary" value="Upload and Process ZIP">
    </form>
    <hr>
    <h4>Current Month Preview</h4>
    <?php
    $current_file = "cal-" . date('Y-m') . ".png";
    if (file_exists($bg_path_base . $current_file)) {
        echo '<img src="' . $bg_url_base . $current_file . '" style="max-width:400px; border:2px solid #333;">';
    } else {
        echo '<p style="color:red;">No background found for ' . date('F Y') . '</p>';
    }
}

function fsb_render_location_manager() {
    global $wpdb;
    $table = $wpdb->prefix . 'fsbhoa_locations';
    $edit_loc = null;
    if (isset($_GET['edit_loc'])) {
        $edit_loc = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", intval($_GET['edit_loc'])));
    }
    if (isset($_POST['save_location'])) {
        check_admin_referer('fsb_location_action', 'fsb_loc_nonce');
        $name = sanitize_text_field($_POST['loc_name']);
        if (!empty($_POST['loc_id'])) {
            $wpdb->update($table, ['name' => $name], ['id' => intval($_POST['loc_id'])]);
        } else {
            $wpdb->insert($table, ['name' => $name]);
        }
        $compiler = new FSBHOA\Cal\Compiler();
        $compiler->bake();
        $edit_loc = null;
    }
    if (isset($_GET['delete_loc']) && wp_verify_nonce($_GET['_wpnonce'], 'delete_loc_' . $_GET['delete_loc'])) {
        $wpdb->delete($table, ['id' => intval($_GET['delete_loc'])]);
        $compiler = new FSBHOA\Cal\Compiler();
        $compiler->bake();
    }
    $results = $wpdb->get_results("SELECT * FROM $table ORDER BY name ASC");
    ?>
    <div class="card" style="max-width: 800px;">
        <h3>Location Management</h3>
        <table class="wp-list-table widefat fixed striped">
            <thead><tr><th>Name</th><th style="width:150px;">Actions</th></tr></thead>
            <tbody>
                <?php foreach ($results as $loc): ?>
                    <tr>
                        <td><strong><?php echo esc_html($loc->name); ?></strong></td>
                        <td>
                            <a href="?page=fsb-cal-settings&tab=locations&edit_loc=<?php echo $loc->id; ?>" class="button button-small">Edit</a>
                            <a href="<?php echo wp_nonce_url("?page=fsb-cal-settings&tab=locations&delete_loc=" . $loc->id, 'delete_loc_' . $loc->id); ?>" class="button button-small" style="color:#a00;">Del</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <div style="margin-top:20px; background:#f9f9f9; padding:20px; border:1px solid #ccc;">
            <h4>Add/Edit Location</h4>
            <form method="post">
                <?php wp_nonce_field('fsb_location_action', 'fsb_loc_nonce'); ?>
                <input type="hidden" name="loc_id" value="<?php echo $edit_loc ? $edit_loc->id : ''; ?>">
                <input type="text" name="loc_name" value="<?php echo $edit_loc ? esc_attr($edit_loc->name) : ''; ?>" required>
                <input type="submit" name="save_location" class="button-primary" value="Save">
            </form>
        </div>
    </div>
    <?php
}

function fsb_render_category_manager() {
    global $wpdb;
    $table = $wpdb->prefix . 'fsbhoa_categories';
    $edit_cat = null;
    if (isset($_GET['edit_cat'])) {
        $edit_cat = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", intval($_GET['edit_cat'])));
    }
    if (isset($_POST['save_cat'])) {
        check_admin_referer('fsb_category_action', 'fsb_cat_nonce');
        $data = ['name' => sanitize_text_field($_POST['cat_name']), 'color_hex' => sanitize_hex_color($_POST['cat_color']), 'svg_path' => sanitize_textarea_field($_POST['svg_path'])];
        if (!empty($_POST['cat_id'])) {
            $wpdb->update($table, $data, ['id' => intval($_POST['cat_id'])]);
        } else {
            $wpdb->insert($table, $data);
        }
        $compiler = new FSBHOA\Cal\Compiler();
        $compiler->bake();
        $edit_cat = null;
    }
    $results = $wpdb->get_results("SELECT * FROM $table ORDER BY name ASC");
    ?>
    <div class="card" style="max-width: 850px;">
        <h3>Event Categories</h3>
        <table class="wp-list-table widefat fixed striped">
            <thead><tr><th>Name</th><th>Color</th><th>Actions</th></tr></thead>
            <tbody>
                <?php foreach ($results as $cat): ?>
                    <tr>
                        <td><strong><?php echo esc_html($cat->name); ?></strong></td>
                        <td><span style="background:<?php echo $cat->color_hex; ?>; color:#fff; padding:2px 5px;"><?php echo $cat->color_hex; ?></span></td>
                        <td><a href="?page=fsb-cal-settings&tab=categories&edit_cat=<?php echo $cat->id; ?>" class="button button-small">Edit</a></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <div style="margin-top:20px; background:#f9f9f9; padding:20px; border:1px solid #ccc;">
            <form method="post">
                <?php wp_nonce_field('fsb_category_action', 'fsb_cat_nonce'); ?>
                <input type="hidden" name="cat_id" value="<?php echo $edit_cat ? $edit_cat->id : ''; ?>">
                <input type="text" name="cat_name" value="<?php echo $edit_cat ? esc_attr($edit_cat->name) : ''; ?>" placeholder="Name" required>
                <input type="color" name="cat_color" value="<?php echo $edit_cat ? esc_attr($edit_cat->color_hex) : '#3498db'; ?>">
                <textarea name="svg_path" placeholder="SVG Path"><?php echo $edit_cat ? esc_textarea($edit_cat->svg_path) : ''; ?></textarea>
                <input type="submit" name="save_cat" class="button-primary" value="Save Category">
            </form>
        </div>
    </div>
    <?php
}

function fsb_render_event_audit() {
    global $wpdb;
    $table_events = $wpdb->prefix . 'fsbhoa_events';
    $table_cats   = $wpdb->prefix . 'fsbhoa_categories';

    $results = $wpdb->get_results("
        SELECT e.*, c.name as cat_name 
        FROM $table_events e
        LEFT JOIN $table_cats c ON e.category_id = c.id
        ORDER BY COALESCE(e.parent_id, e.id) DESC, (CASE WHEN e.parent_id IS NULL THEN 0 ELSE 1 END) ASC, e.id ASC
        LIMIT 200
    ");

    $today = date('Y-m-d');
    ?>
    <div class="card" style="max-width: 100%; margin-top: 0; position: relative;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
            <h3 style="margin:0;">Database Audit Log</h3>
            <span title="Add New Event" style="color:#0056b3; cursor:pointer; font-size:2.2rem; font-weight:900; line-height:1; padding: 0 10px;" onclick="openAddModal(null)">+</span>
        </div>

        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th style="width: 80px;">DB ID</th>
                    <th>Event Title</th>
                    <th style="width: 130px;">Start Date</th>
                    <th style="width: 90px;">Status</th>
                    <th style="width: 180px;">Type / Recurrence</th>
                    <th style="width: 150px;">Owner</th>
                    <th style="width: 100px; text-align:center;">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($results as $e) : 
                    $is_child = !empty($e->parent_id);
                    $is_hole = ($e->status === 'cancelled');
                    $row_style = $is_child ? 'background: #fdfdfd;' : 'background: #f0f6fb; font-weight: 600;';
                    if ($is_hole) $row_style .= ' opacity: 0.6;';
                    $target_date = date('Y-m-d', strtotime($e->start_datetime));
                ?>
                    <tr style="<?php echo $row_style; ?>">
                        <td><code>#<?php echo $e->id; ?></code></td>
                        <td><span style="<?php echo $is_child ? 'margin-left: 20px;' : ''; ?>"><?php echo esc_html($e->title); ?></span></td>
                        <td><?php echo $target_date; ?></td>
                        <td><span class="status-tag <?php echo $e->status; ?>" style="text-transform: uppercase; font-size: 8px; font-weight: bold; border: 1px solid; padding: 2px 4px; border-radius: 3px;"><?php echo esc_html($e->status); ?></span></td>
                        <td>
                            <div style="font-size: 11px;"><?php echo $e->rrule ? '<strong>Master Series</strong>' : ($is_child ? ($is_hole ? 'Exception (Hole)' : 'Pivot/Move') : 'Single'); ?></div>
                            <?php if ($e->rrule || ($is_child && !$is_hole)) : ?>
                                <div style="font-size: 10px; color: #2271b1; margin-top: 4px; word-break: break-all;"><code><?php echo esc_html(str_replace('RRULE:', '', $e->rrule)); ?></code></div>
                            <?php endif; ?>
                        </td>
                        <td style="font-size: 11px;"><?php echo esc_html($e->owner_email); ?></td>
                        <td style="text-align:center; font-size: 1.2rem;">
                            <?php if (!$is_hole): ?>
                                <span title="Edit" style="color:#f57c00; cursor:pointer; margin-right:12px;" onclick="handleEditClick(<?php echo $e->id; ?>, '<?php echo $target_date; ?>', <?php echo $e->id; ?>, null)">✎</span>
                            <?php endif; ?>
                            <span title="Delete" style="color:#d32f2f; cursor:pointer;" onclick="handleAuditDelete(<?php echo $e->id; ?>)">&times;</span>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <div id="fsb-calendar-app" style="display:none;"></div>

    <div id="fsb-edit-modal" class="fsb-modal">
        <div class="modal-content">
            <span class="close-modal" onclick="closeAdminModals()">&times;</span>
            <div id="edit-form-container"></div>
        </div>
    </div>

    <div id="fsb-day-modal" class="fsb-modal">
        <div class="modal-content">
            <span class="close-modal" onclick="closeAdminModals()">&times;</span>
            <div id="fsb-modal-content"></div>
        </div>
    </div>

    <script>
        // 1. Initialize the global config if it's missing in Admin
        window.config = window.config || {
            isAdmin: true,
            userEmail: '<?php echo wp_get_current_user()->user_email; ?>'
        };

        function closeAdminModals() {
            document.querySelectorAll('.fsb-modal').forEach(m => m.classList.remove('is-visible'));
            document.body.style.removeProperty('overflow');
            document.documentElement.style.removeProperty('overflow');
            document.body.classList.add('fsb-admin-scroll-fix');
            document.body.classList.remove('modal-open');
        }

        // 2. Ensure Add Modal works even if logic.js hasn't attached listeners yet
        function openAddModal(dateStr) {
            if (typeof window.openEditModal === 'function') {
                window.openEditModal(dateStr, null, null, null, null);
            } else {
                console.error("Calendar logic not loaded yet.");
            }
        }

        async function handleAuditDelete(id) {
            if(confirm('Permanently delete record #' + id + '?')) {
                const params = new URLSearchParams({
                    action: 'fsb_save_calendar_event',
                    edit_mode: 'master_delete',
                    event_id: id,
                    nonce: '<?php echo wp_create_nonce('fsb_cal_nonce'); ?>'
                });
                const response = await fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    body: params
                });
                const result = await response.json();
                if(result.success) { location.reload(); } else { alert(result.data); }
            }
        }
        </script>
    <?php
}



