<?php

// ==========================================
// PRO LICENSE & AUTO-INSTALLER ENGINE
// ==========================================

// Ensure our constants exist (in case they aren't in the main plugin file yet)
if ( ! defined( 'HOAPLUGIN_LICENSE_SERVER_URL' ) ) {
    define( 'HOAPLUGIN_LICENSE_SERVER_URL', 'https://HOAplugin.com' );
}
if ( ! defined( 'HOAPLUGiN_PRO_SHARED_SECRET' ) ) {
    define( 'HOAPLUGIN_PRO_SHARED_SECRET', '!*UuYp5iYLmsTM*' );
}

function hoa_render_pro_license_installer() {
    $license_key = is_multisite() ? get_site_option('hoa_pro_license_key') : get_option('hoa_pro_license_key');

    // 1. Force WP to load the plugin library so we can accurately check if Pro is active
    if ( ! function_exists( 'is_plugin_active' ) ) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $is_pro_active = is_plugin_active('hoaplugin-calendar-pro/hoaplugin-calendar-pro.php');
    ?>
    <div class="card" style="max-width: 600px; padding: 20px; margin-top: 0;">
        <h3 style="margin-top: 0;">HOAplugin Calendar Pro</h3>

        <?php
        // 🚀 DEVELOPMENT UI INTERCEPTION:
        // Display a warning on the local Pi that updates from the license server will not download.
        if ( function_exists( 'wp_get_environment_type' ) && wp_get_environment_type() === 'local' ) {
            ?>
            <div style="background: #fff8e5; border-left: 4px solid #ffb900; padding: 15px; margin-bottom: 10px; border-radius: 4px;">
                <strong style="color: #b25e00;">Local Testbed Mode Active</strong><br>
                The automated Pro zip installer is deactivated on this machine to safeguard your symlinked development repositories from being deleted or modified.<br><br>
                To test Pro capabilities locally, navigate directly to the core <a href="<?php echo admin_url('plugins.php'); ?>"><strong>Plugins dashboard</strong></a> and activate your local <em>hoaplugin-calendar-pro</em> repository branch manually.
            </div>
            </div> <?php
        }

        // DIAGNOSTICS: Print out exactly what went wrong if the physical installation fails
        if ( isset($_GET['pro_status']) ) {
            $status = sanitize_text_field($_GET['pro_status']);
            if ( $status === 'install_fail' ) echo '<div style="color:#d32f2f; margin-bottom:15px; font-weight:bold;">Error: WP Upgrader failed to extract the ZIP.</div>';
            if ( $status === 'file_missing' ) echo '<div style="color:#d32f2f; margin-bottom:15px; font-weight:bold;">Error: ZIP extracted, but the plugin file was not found! Check ZIP folder structure.</div>';
            if ( $status === 'activation_fail' ) echo '<div style="color:#d32f2f; margin-bottom:15px; font-weight:bold;">Error: Plugin installed, but WP refused to activate it. Check PHP error log.</div>';
        }
        ?>

        <?php if ( $is_pro_active && !empty($license_key) ) : ?>

            <div style="background: #e7f5ea; border-left: 4px solid #46b450; padding: 12px;">
                <strong>Pro Version is Active!</strong> Your license key is installed and automated updates are running.
            </div>
            <p style="margin-top: 15px;"><strong>Current Key:</strong> <code><?php echo esc_html($license_key); ?></code></p>

        <?php else : ?>

            <p>Enter your License Key to instantly download, install, and activate the Pro features.</p>
            <form method="post" action="<?php echo esc_url( admin_url('admin-post.php') ); ?>">
                <input type="hidden" name="action" value="hoa_install_pro_plugin">
                <?php wp_nonce_field('hoa_install_pro_nonce'); ?>

                <table class="form-table">
                    <!-- EMAIL FIELD HAS BEEN REMOVED! -->
                    <tr valign="top">
                        <th scope="row">License Key:</th>
                        <td>
                            <input type="text" name="hoa_pro_license_key"
                                   value="<?php echo esc_attr($license_key); ?>"
                                   class="regular-text" placeholder="XXXX-XXXX-XXXX-XXXX" required />
                        </td>
                    </tr>
                </table>
                <?php submit_button('Install & Activate Pro'); ?>
            </form>

        <?php endif; ?>
    </div>
    <?php
}
add_action( 'admin_post_hoa_install_pro_plugin', 'hoa_handle_pro_installation' );
function hoa_handle_pro_installation() {
    if ( ! current_user_can('install_plugins') || ! check_admin_referer('hoa_install_pro_nonce') ) {
        wp_die('Unauthorized');
    }

    if ( function_exists( 'wp_get_environment_type' ) && wp_get_environment_type() === 'local' ) {
        wp_die( '<strong>Operation Blocked:</strong> Local testbed mode.' );
    }

    $key = sanitize_text_field($_POST['hoa_pro_license_key']);
    $pro_path = 'hoaplugin-calendar-pro/hoaplugin-calendar-pro.php';
    $redirect_url = admin_url('admin.php?page=hoa-cal-settings&tab=license');

    $site_url = get_site_url(); // Keeps each multisite sub-site isolated as its own activation slot

    // 1. PHASE A: SEND INITIAL HANDSHAKE TO RECEIVE ACTIVATION TOKEN
    $check_url = add_query_arg( array(
        'action'      => 'activate',
        'license_key' => $key,
        'site_url'    => $site_url,
        'nocache'     => time()
    ), HOAPLUGIN_LICENSE_SERVER_URL . '/wp-json/hoa-licensing/v1/license' );

    $response = wp_remote_get( $check_url, array( 'timeout' => 15 ) );

    // ERROR STATE A: Hard Network Failures (Timeout, DNS down, Server offline)
    if ( is_wp_error( $response ) ) {
        wp_die( '<strong>Network Error:</strong> Server unreachable: ' . esc_html( $response->get_error_message() ) );
    }

    $http_code = wp_remote_retrieve_response_code( $response );
    $body_raw  = wp_remote_retrieve_body( $response );
    $body      = json_decode( $body_raw, true );

    // ERROR STATE B: HTTP Rejections (401 Unauthorized / 403 Forbidden)
    if ( $http_code === 401 || $http_code === 403 ) {
        // Try to grab the exact die() message from the server, fallback to generic
        $error_msg = ! empty( $body_raw ) ? strip_tags( $body_raw ) : 'License key is invalid, expired, or has been revoked.';
        wp_send_json_error( array( 'message' => 'Activation Rejected: ' . $error_msg ) );
    }
    if ( $http_code !== 200 ) {
        wp_send_json_error( array( 'message' => 'License server returned an unexpected error (HTTP ' . $http_code . ').' ) );
    }

    // ERROR STATE C: Soft Rejections (e.g., Maximum activations reached)
    // The server returns HTTP 200, but wp_send_json_error() sets success to false
    if ( empty( $body['success'] ) ) {
        $error_msg = ! empty( $body['data']['message'] ) ? $body['data']['message'] : 'Failed to secure a slot on the license server.';
        wp_send_json_error( array( 'message' => $error_msg ) );
    }

    // ERROR STATE D: Bad Payload (We got a success, but the token is missing)
    if ( empty( $body['data']['activation_token'] ) ) {
        wp_send_json_error( array( 'message' => 'Invalid response from license server. No token provided.' ) );
    }

    // Extract our newly issued site token
    $activation_token = isset( $body['data']['activation_token'] ) ? sanitize_text_field($body['data']['activation_token']) : '';

    if ( empty( $activation_token ) ) {
        wp_die( '<strong>Security Error:</strong> Server verified activation slot but failed to output a security token token.' );
    }

    // 2. SAVE KEYS AND TOKENS MULTISITE COMPATIBLE
    if ( is_multisite() ) {
        update_site_option('hoa_pro_license_key', $key);
        update_site_option('hoa_pro_activation_token', $activation_token);
    } else {
        update_option('hoa_pro_license_key', $key);
        update_option('hoa_pro_activation_token', $activation_token);
    }

    // 3. PHASE B: CONSTRUCT THE SIGNED DOWNLOAD LINK
    $install_result = false;

    // Folder is missing, proceed with cryptographic ZIP delivery
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';

    // THE WIPER: Delete the existing folder so the Upgrader doesn't crash, ensuring fresh code.
    $pro_dir = WP_PLUGIN_DIR . '/hoaplugin-calendar-pro';
    if ( file_exists( $pro_dir ) ) {
        WP_Filesystem();
        global $wp_filesystem;
        $wp_filesystem->delete( $pro_dir, true ); // The 'true' flag deletes the directory recursively
    }

    $time = time();
    $signature = hash_hmac( 'sha256', $key . $site_url . $time, $activation_token );

    $download_url = add_query_arg( array(
        'action'      => 'download',
        'slug'        => 'hoaplugin-calendar-pro',
        'license_key' => $key,
        'site_url'    => $site_url,
        'token'       => $signature,
        'timestamp'   => $time
    ), HOAPLUGIN_LICENSE_SERVER_URL . '/wp-json/hoa-licensing/v1/license' );

    $skin     = new Automatic_Upgrader_Skin();
    $upgrader = new Plugin_Upgrader( $skin );
    $install_result = $upgrader->install( $download_url );

    // ==========================================
    // 🚨 THE NUCLEAR DEBUG TRAP 🚨
    // ==========================================
    if ( ! file_exists( WP_PLUGIN_DIR . '/' . $pro_path ) ) {
        echo "<div style='background:#fff; border:2px solid #d00; padding:20px; max-width: 800px; margin: 20px auto; font-family: monospace;'>";
        echo "<h2 style='color:#d00; margin-top:0;'>Diagnostic Trap Triggered</h2>";

        // 1. What did the upgrader return?
        echo "<h3>1. Upgrader Return Value</h3><pre style='background:#eee; padding:10px;'>";
        var_dump($install_result);
        echo "</pre>";

        if ( is_wp_error( $install_result ) ) {
            echo "<p><strong>WP_Error Message:</strong> " . esc_html( $install_result->get_error_message() ) . "</p>";
        }

        // 2. What folders actually exist in the plugins directory right now?
        echo "<h3>2. Plugin Directory Contents</h3>";
        echo "<p>Checking: <code>" . WP_PLUGIN_DIR . "</code></p><pre style='background:#eee; padding:10px;'>";
        $dirs = glob( WP_PLUGIN_DIR . '/*' , GLOB_ONLYDIR );
        foreach( $dirs as $dir ) {
            echo basename( $dir ) . "\n";
        }
        echo "</pre>";

        // 3. Raw Network Test (What is the server ACTUALLY serving us?)
        echo "<h3>3. Raw Network Download Test</h3>";
        $test_dl = wp_remote_get( $download_url, array( 'timeout' => 15 ) );

        if ( is_wp_error( $test_dl ) ) {
            echo "<p><strong>Network Error:</strong> " . esc_html( $test_dl->get_error_message() ) . "</p>";
        } else {
            $headers = wp_remote_retrieve_headers( $test_dl );
            $content_type = isset( $headers['content-type'] ) ? $headers['content-type'] : 'UNKNOWN';

            echo "<p><strong>HTTP Status:</strong> " . wp_remote_retrieve_response_code( $test_dl ) . "</p>";
            echo "<p><strong>Content-Type:</strong> " . esc_html( $content_type ) . "</p>";

            if ( strpos( strtolower( $content_type ), 'zip' ) === false ) {
                echo "<p style='color:#d00;'><strong>🚨 CRITICAL: The server did NOT send a ZIP file. It sent this:</strong></p>";
                echo "<textarea style='width:100%; height:200px; font-family:monospace;'>" . esc_textarea( wp_remote_retrieve_body( $test_dl ) ) . "</textarea>";
            } else {
                echo "<p style='color:#0a0;'><strong>SUCCESS:</strong> The server successfully delivered a ZIP payload. The extraction logic is failing.</p>";
            }
        }

        echo "</div>";
        die(); // HALT COMPLETELY - DO NOT REDIRECT
    }
    // ==========================================

    if ( is_wp_error( $install_result ) ) {
        wp_redirect( add_query_arg('pro_status', 'install_fail', $redirect_url) );
        exit;
    } elseif ( $install_result === false ) {
        wp_redirect( add_query_arg('pro_status', 'install_fail', $redirect_url) );
        exit;
    }

    // 5. Activate the newly installed plugin
    if ( file_exists( WP_PLUGIN_DIR . '/' . $pro_path ) ) {
        clearstatcache();
        wp_cache_delete( 'plugins', 'plugins' );
        $activation_result = activate_plugin( $pro_path );

        if ( is_wp_error( $activation_result ) ) {
            error_log( 'HOAPLUGIN Pro Auto-Activation Error: ' . $activation_result->get_error_message() );
            wp_redirect( add_query_arg('pro_status', 'activation_fail', $redirect_url) );
            exit;
        } else {
            // SUCCESS!
            wp_redirect( $redirect_url );
            exit;
        }
    } else {
        wp_redirect( add_query_arg('pro_status', 'file_missing', $redirect_url) );
        exit;
    }
}


// ==========================================
// TESTBED BYPASS: Generalized Local File Router
// ==========================================
add_filter('upgrader_pre_download', 'hoa_testbed_local_download_bypass', 10, 3);

function hoa_testbed_local_download_bypass($reply, $package, $upgrader) {
    // 1. Only intercept if WP is targeting our local License Server API
    if ( strpos( $package, '/wp-json/hoa-licensing/v1/check' ) !== false ) {

        // 2. Break apart the URL to read the query parameters
        $parsed_url = wp_parse_url( $package );

        if ( isset( $parsed_url['query'] ) ) {
            parse_str( $parsed_url['query'], $query_params );

            // 3. Extract the requested slug (e.g., 'hoaplugin-calendar' or 'hoaplugin-calendar-pro')
            if ( ! empty( $query_params['slug'] ) ) {
                $slug = sanitize_file_name( $query_params['slug'] );

                // 4. Construct the expected local path
                $upload_dir = wp_upload_dir();
                $local_zip  = $upload_dir['basedir'] . '/' . $slug . '.zip';

                // 5. If the file is physically there, hand it directly to the Upgrader
                if ( file_exists( $local_zip ) ) {
                    return $local_zip;
                }
            }
        }
    }

    // If it's not our API, or the file doesn't exist, let WP proceed normally
    return $reply;
}
