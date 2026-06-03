<?php
// 1. Abort if this file is accessed directly or by a bot
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    die;
}

// 2. Check if the user explicitly opted in to data destruction
if ( get_option( 'fsbhoa_nuke_on_delete' ) == '1' ) {
    
    global $wpdb;

    // A. Delete json_file and all background uploads
    // Safely delete the entire directory
    if ( file_exists( FSBHOA_CALENDAR_DIR ) ) {
        require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
        $fs = new WP_Filesystem_Direct( null );
        $fs->rmdir( FSBHOA_CALENDAR_DIR, true );
    }

    // B. Drop Custom Tables
    $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}fsbhoa_events" );
    $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}fsbhoa_schedules" );
    // (Add any other custom tables you created here)

    // C. Delete Base Plugin Options
    delete_option( 'fsbhoa_calendar_version' );
    delete_option( 'fsbhoa_calendar_settings' ); // If you save settings as an array
    
    // D. Delete Pro License Options (to leave the database perfectly clean)
    delete_option( 'fsb_pro_license_key' );
    if ( is_multisite() ) {
        delete_site_option( 'fsb_pro_license_key' );
    }

    // E. Finally, delete the nuke option itself
    delete_option( 'fsbhoa_nuke_on_delete' );
}
