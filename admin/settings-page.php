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
        </h2>

        <div style="margin-top: 20px;">
            <?php
            switch($active_tab) {
            case 'settings':
                fsb_render_settings_manager();
                break;
            case 'locations':
                fsb_render_location_manager();
                break;
            case 'categories':
                fsb_render_category_manager();
                break;
            default:
                fsb_render_bg_manager();
                break;
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
                // This outputs the hidden fields (nonce, etc.) for the group
                settings_fields('fsb_cal_settings_group');
                do_settings_sections('fsb_cal_settings_group');
            ?>

            <div style="background:#fff; padding:20px; border:1px solid #ccc; margin-top:20px; border-radius:4px;">
                <h3 style="margin-top:0;">Baking & Data Configuration</h3>
                <p class="description">Control how the calendar JSON is pre-calculated and stored.</p>

                <table class="form-table">
                    <tr>
                        <th scope="row">Past Months:</th>
                        <td>
                            <input type="number" name="fsb_cal_past_months" value="<?php echo esc_attr($past_val); ?>" style="width:70px;">
                            <span class="description">How many months of history to include.</span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Future Months:</th>
                        <td>
                            <input type="number" name="fsb_cal_future_months" value="<?php echo esc_attr($future_val); ?>" style="width:70px;">
                            <span class="description">How far into the future to calculate.</span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">JSON Storage Path:</th>
                        <td>
                            <input type="text" name="fsb_cal_json_path" value="<?php echo esc_attr($json_path); ?>" class="large-text" style="font-family:monospace;">
                            <p class="description">Full server path to your .json file. Normally: /var/www/html/wp-content/uploads/fsbhoa-calendar/calendar-events.json</p>
                        </td>
                    </tr>
                </table>
            </div>

            <div style="background:#fff; padding:20px; border:1px solid #ccc; margin-top:20px; border-radius:4px;">
                <h3 style="margin-top:0;">Display Preferences</h3>
                <table class="form-table">
                    <tr>
                        <th scope="row">Time Placement:</th>
                        <td>
                            <select name="fsb_time_position">
                                <option value="prepend" <?php selected($time_pos, 'prepend'); ?>>Time First (9am Title)</option>
                                <option value="append" <?php selected($time_pos, 'append'); ?>>Title First (Title 9am)</option>
                                <option value="hidden" <?php selected($time_pos, 'hidden'); ?>>Hide Time (Title only)</option>
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

function fsb_handle_zip_upload() {
    if (!isset($_FILES['cal_zip']) || empty($_FILES['cal_zip']['name'])) return;

    require_once(ABSPATH . 'wp-admin/includes/file.php');
    WP_Filesystem();
    global $wp_filesystem;

    $upload_dir = wp_upload_dir();
    // This will resolve to /var/www/html/wp-content/uploads/fsbhoa-calendar/backgrounds/ 
    $target_dir = $upload_dir['basedir'] . '/fsbhoa-calendar/backgrounds/';

    // This will resolve to http://localhost/wp-content/uploads/fsbhoa-calendar/backgrounds/
    $target_url = $upload_dir['baseurl'] . '/fsbhoa-calendar/backgrounds/';

    if (!file_exists($target_dir)) {
        wp_mkdir_p($target_dir);
    }

    $zip_file = $_FILES['cal_zip']['tmp_name'];
    $unzip_result = unzip_file($zip_file, $target_dir);

    if (is_wp_error($unzip_result)) {
        echo '<div class="error"><p>Error unzipping: ' . $unzip_result->get_error_message() . '</p></div>';
    } else {
        // --- START ROLLING CLEANUP ---
        $files = glob($target_dir . 'cal-*.png');
        $one_year_ago = strtotime('-1 year');
        $deleted_count = 0;

        foreach ($files as $file) {
            // Extract YYYY-MM from filename: cal-2025-03.png
            if (preg_match('/cal-(\d{4}-\d{2})\.png/', basename($file), $matches)) {
                $file_date = strtotime($matches[1] . '-01'); // Treat as first of the month
                if ($file_date < $one_year_ago) {
                    unlink($file);
                    $deleted_count++;
                }
            }
        }
        // --- END ROLLING CLEANUP ---

        echo "<div class='updated'><p>Backgrounds updated! (Cleaned up $deleted_count old files).</p></div>";
    }
}

function fsb_render_bg_manager() {
    if (isset($_POST['fsb_upload_zip'])) {
        fsb_handle_zip_upload();
    }

    $upload_dir = wp_upload_dir();
    $bg_url_base = $upload_dir['baseurl'] . '/fsbhoa-calendar/backgrounds/';
    $bg_path_base = $upload_dir['basedir'] . '/fsbhoa-calendar/backgrounds/';
    $current_file = "cal-" . date('Y-m') . ".png";

    ?>
    <h3>Monthly Backgrounds (ZIP Upload)</h3>
    <p>Upload a ZIP file containing images named <strong>cal-YYYY-MM.png</strong> (e.g., <em>cal-2026-03.png</em>).</p>

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
        echo '<p style="color:red;">No background found for ' . date('F Y') . ' (Expected: ' . $current_file . ')</p>';
    }
}


function fsb_render_location_manager() {
    global $wpdb;
    $table = $wpdb->prefix . 'fsbhoa_locations';
    $edit_loc = null;

    // 1. Handle "Edit" Mode Detection
    if (isset($_GET['edit_loc'])) {
        $edit_id = intval($_GET['edit_loc']);
        $edit_loc = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $edit_id));
    }

    // 2. Handle Form Submission (Add or Update)
    if (isset($_POST['save_location'])) {
        check_admin_referer('fsb_location_action', 'fsb_loc_nonce');

        $loc_name = sanitize_text_field($_POST['loc_name']);

        if (!empty($loc_name)) {
            if (!empty($_POST['loc_id'])) {
                // UPDATE
                $wpdb->update($table, ['name' => $loc_name], ['id' => intval($_POST['loc_id'])]);
                echo '<div class="updated"><p>Location updated.</p></div>';
            } else {
                // INSERT
                $wpdb->insert($table, ['name' => $loc_name]);
                echo '<div class="updated"><p>Location added.</p></div>';
            }

            $compiler = new FSBHOA\Cal\Compiler();
            $compiler->bake();

            // Clear edit mode
            $edit_loc = null;
        }
    }

    // 3. Handle Deletion
    if (isset($_GET['delete_loc']) && isset($_GET['_wpnonce'])) {
        if (wp_verify_nonce($_GET['_wpnonce'], 'delete_loc_' . $_GET['delete_loc'])) {
            $wpdb->delete($table, ['id' => intval($_GET['delete_loc'])]);
            $compiler = new FSBHOA\Cal\Compiler();
            $compiler->bake();
            echo '<div class="updated"><p>Location deleted.</p></div>';
        }
    }

    $results = $wpdb->get_results("SELECT * FROM $table ORDER BY name ASC");
    ?>
    <div class="card" style="max-width: 800px;">
        <h3>Room & Location Management</h3>
        <p class="description">Define the specific areas within the community (e.g., Lodge, Ballroom, Pool).</p>

        <table class="wp-list-table widefat fixed striped" style="margin-top: 20px;">
            <thead>
                <tr>
                    <th>Location Name</th>
                    <th style="width: 150px;">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($results)) : ?>
                    <tr><td colspan="2">No locations defined.</td></tr>
                <?php else : ?>
                    <?php foreach ($results as $loc):
                        $delete_url = wp_nonce_url("?page=fsb-cal-settings&tab=locations&delete_loc=" . $loc->id, 'delete_loc_' . $loc->id);
                        $edit_url = "?page=fsb-cal-settings&tab=locations&edit_loc=" . $loc->id;
                    ?>
                        <tr>
                            <td><strong><?php echo esc_html($loc->name); ?></strong></td>
                            <td>
                                <a href="<?php echo $edit_url; ?>" class="button button-small">Edit</a>
                                <a href="<?php echo $delete_url; ?>"
                                   class="button button-small"
                                   style="color:#a00;"
                                   onclick="return confirm('Delete this location? Events using it will show TBD.');">Del</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <div style="margin-top:30px; background:#f9f9f9; padding:20px; border:1px solid #ccc; border-radius: 4px;">
            <h4><?php echo $edit_loc ? 'Edit Location: ' . esc_html($edit_loc->name) : 'Add New Location'; ?></h4>
            <form method="post" action="?page=fsb-cal-settings&tab=locations">
                <?php wp_nonce_field('fsb_location_action', 'fsb_loc_nonce'); ?>
                <input type="hidden" name="loc_id" value="<?php echo $edit_loc ? $edit_loc->id : ''; ?>">

                <div style="margin-bottom: 15px;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px;">Location Name:</label>
                    <input type="text" name="loc_name" value="<?php echo $edit_loc ? esc_attr($edit_loc->name) : ''; ?>"
                           placeholder="e.g. Lodge" class="regular-text" required>
                </div>

                <input type="submit" name="save_location" class="button-primary" value="<?php echo $edit_loc ? 'Update Location' : 'Add Location'; ?>">
                <?php if ($edit_loc) : ?>
                    <a href="?page=fsb-cal-settings&tab=locations" class="button">Cancel</a>
                <?php endif; ?>
            </form>
        </div>
    </div>
    <?php
}



function fsb_render_category_manager() {
    global $wpdb;
    $table = $wpdb->prefix . 'fsbhoa_categories';
    $edit_cat = null;

    // 1. Handle "Edit" Mode Detection
    if (isset($_GET['edit_cat'])) {
        $edit_id = intval($_GET['edit_cat']);
        $edit_cat = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $edit_id));
    }

    // 2. Handle Form Submission (Add or Update)
    if (isset($_POST['save_cat'])) {
        check_admin_referer('fsb_category_action', 'fsb_cat_nonce');
        
        $data = [
            'name'      => sanitize_text_field($_POST['cat_name']),
            'color_hex' => sanitize_hex_color($_POST['cat_color']),
            'svg_path'  => sanitize_textarea_field($_POST['svg_path'])
        ];

        if (!empty($_POST['cat_id'])) {
            // UPDATE
            $wpdb->update($table, $data, ['id' => intval($_POST['cat_id'])]);
            echo '<div class="updated"><p>Category updated.</p></div>';
        } else {
            // INSERT
            $wpdb->insert($table, $data);
            echo '<div class="updated"><p>Category added.</p></div>';
        }

        $compiler = new FSBHOA\Cal\Compiler();
        $compiler->bake();
        
        // Clear edit mode after save
        $edit_cat = null;
    }

    // 3. Handle Deletion
    if (isset($_GET['delete_cat']) && isset($_GET['_wpnonce'])) {
        if (wp_verify_nonce($_GET['_wpnonce'], 'delete_cat_' . $_GET['delete_cat'])) {
            $wpdb->delete($table, ['id' => intval($_GET['delete_cat'])]);
            $compiler = new FSBHOA\Cal\Compiler();
            $compiler->bake();
            echo '<div class="updated"><p>Category deleted.</p></div>';
        }
    }

    $results = $wpdb->get_results("SELECT * FROM $table ORDER BY name ASC");
    ?>
    <div class="card" style="max-width: 850px;">
        <h3>Event Categories</h3>
        <p class="description">Categories with an SVG path will render as corner icons on the grid.</p>

        <table class="wp-list-table widefat fixed striped" style="margin-top: 20px;">
            <thead>
                <tr>
                    <th style="width: 25%;">Name</th>
                    <th style="width: 20%;">Color</th>
                    <th style="width: 35%;">Icon Preview</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($results)) : ?>
                    <tr><td colspan="4">No categories defined.</td></tr>
                <?php else : ?>
                    <?php foreach ($results as $cat): 
                        $delete_url = wp_nonce_url("?page=fsb-cal-settings&tab=categories&delete_cat=" . $cat->id, 'delete_cat_' . $cat->id);
                        $edit_url = "?page=fsb-cal-settings&tab=categories&edit_cat=" . $cat->id;
                    ?>
                        <tr>
                            <td><strong><?php echo esc_html($cat->name); ?></strong></td>
                            <td>
                                <span style="background:<?php echo $cat->color_hex; ?>; padding: 4px 10px; border-radius: 4px; color: #fff; text-shadow: 1px 1px 1px #000; font-size: 11px;">
                                    <?php echo esc_html($cat->color_hex); ?>
                                </span>
                            </td>
                            <td>
                                <?php if ($cat->svg_path): ?>
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:<?php echo $cat->color_hex; ?>;">
                                            <path d="<?php echo esc_attr($cat->svg_path); ?>"></path>
                                        </svg>
                                        <code style="font-size: 10px; color: #888; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 150px;">
                                            <?php echo esc_html($cat->svg_path); ?>
                                        </code>
                                    </div>
                                <?php else: ?>
                                    <span class="description" style="font-size: 11px;">Standard Bar</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <a href="<?php echo $edit_url; ?>" class="button button-small">Edit</a>
                                <a href="<?php echo $delete_url; ?>" class="button button-small" style="color:#a00;" onclick="return confirm('Delete this category?');">Del</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <div style="margin-top:30px; background:#f9f9f9; padding:20px; border:1px solid #ccc; border-radius: 4px;">
            <h4><?php echo $edit_cat ? 'Edit Category: ' . esc_html($edit_cat->name) : 'Add New Category'; ?></h4>
            <form method="post" action="?page=fsb-cal-settings&tab=categories">
                <?php wp_nonce_field('fsb_category_action', 'fsb_cat_nonce'); ?>
                <input type="hidden" name="cat_id" value="<?php echo $edit_cat ? $edit_cat->id : ''; ?>">

                <div style="margin-bottom: 15px;">
                    <label style="display:block; font-weight:bold;">Category Name:</label>
                    <input type="text" name="cat_name" value="<?php echo $edit_cat ? esc_attr($edit_cat->name) : ''; ?>" class="regular-text" required>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display:block; font-weight:bold;">Display Color:</label>
                    <input type="color" name="cat_color" value="<?php echo $edit_cat ? esc_attr($edit_cat->color_hex) : '#3498db'; ?>" style="height:35px; width:60px; cursor:pointer;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display:block; font-weight:bold;">Icon SVG Path (The 'd' attribute):</label>
                    <textarea name="svg_path" rows="3" style="width:100%; font-family:monospace;" placeholder="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10..."><?php echo $edit_cat ? esc_textarea($edit_cat->svg_path) : ''; ?></textarea>
                    <p class="description">Leave blank for standard events. Paste only the path data from an SVG.</p>
                </div>

                <input type="submit" name="save_cat" class="button-primary" value="<?php echo $edit_cat ? 'Update Category' : 'Add Category'; ?>">
                <?php if ($edit_cat) : ?>
                    <a href="?page=fsb-cal-settings&tab=categories" class="button">Cancel</a>
                <?php endif; ?>
            </form>
        </div>
    </div>
    <?php
}

