<?php
// 1. Abort if this file is accessed directly or by a bot
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    die;
}

// ========================================================
// DEFENSIVE ABORT: DO NOT DESTROY DATA IF PRO IS ACTIVE
// ========================================================
$active_plugins = apply_filters( 'active_plugins', get_option( 'active_plugins' ) );
if ( in_array( 'hoaplugin-calendar-pro/hoaplugin-calendar-pro.php', $active_plugins ) ) {
    // The user is just deleting the Free plugin to clean up their dashboard.
    // The Pro plugin is still using this database table and upload folder.
    // Exit silently and leave the data alone.
    return;
}

// 2. Check if the user explicitly opted in to data destruction
if ( get_option( 'hoaplugin_nuke_on_delete' ) == '1' ) {

    // A. Delete json_file and all background uploads
    // Safely delete the entire directory
    $upload_dir = wp_upload_dir();
    $hoa_dir = $upload_dir['basedir'] . '/hoaplugin-calendar';
    if ( file_exists( $hoa_dir ) ) {
        require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
        $fs = new WP_Filesystem_Direct( null );
        $fs->rmdir( $hoa_dir, true );
    }

    // B. Drop Custom Tables
    global $wpdb;
    $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}hoaplugin_events" );
    $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}hoaplugin_categories" );
    $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}hoaplugin_locations" );

    // C. Delete Base Plugin Options
    delete_option('hoa_calendar_bgs');
    delete_option('hoa_cal_past_months');
    delete_option('hoa_cal_future_months');
    delete_option('hoa_time_position');
    delete_option('hoa_time_format');
    delete_option('hoa_start_day');
    delete_option('hoa_cal_version');
    delete_option('hoaplugin_defaults_installed');
    
    // D. Delete Pro License Options (to leave the database perfectly clean)
    delete_option( 'hoaplugin_pro_activation_token' );
    delete_option( 'hoa_pro_license_key' );
    if ( is_multisite() ) {
        delete_site_option( 'hoa_pro_license_key' );
    }

    // E. Finally, delete the nuke option itself
    delete_option( 'hoaplugin_nuke_on_delete' );
}
