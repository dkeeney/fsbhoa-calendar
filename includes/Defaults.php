<?php
// includes/defaults.php

if ( ! defined( 'ABSPATH' ) ) exit;
        
/**
 * Pre-populates the calendar database with helpful default categories and locations.
 * This is only executed if the tables are completely empty.
 */
function hoaplugin_populate_default_data( $cat_table, $loc_table, $event_table ) {
    global $wpdb;

    $can_icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
</svg>';
    $street_sweeper_icon = '<svg viewBox="0 0 30 17" xmlns="http://www.w3.org/2000/svg">
        
          <path d="m 19.457031,13.933594 c 0.08594,-1.140625 1.042969,-2.042969 2.207031,-2.042969 1.167969,0 2.121094,0.902344 2.207032,2.042969 0.0078,0.05859 0.0078,0.113281 0.0078,0.171875 0,1.21875 -0.988281,2.214843 -2.214844,2.214843 -1.222656,0 -2.214843,-0.996093 -2.214843,-2.214843 0,-0.05859 0.0039,-0.113281 0.0078,-0.171875 z m 1.167969,0 c 0,0.574218 0.464844,1.042968 1.039062,1.042968 0.574219,0 1.039063,-0.46875 1.039063,-1.042968 0,-0.570313 -0.464844,-1.039063 -1.039063,-1.039063 -0.574218,0 -1.039062,0.46875 -1.039062,1.039063 z m 0,0" />
        
        <path d="m 21.664062,13.171875 c 0.417969,0 0.761719,0.34375 0.761719,0.761719 0,0.421875 -0.34375,0.761718 -0.761719,0.761718 -0.421874,0 -0.761718,-0.339843 -0.761718,-0.761718 0,-0.417969 0.339844,-0.761719 0.761718,-0.761719 z m 0,0" />
        
          <path d="M 4.664062,13.933594 C 4.75,12.792969 5.707031,11.890625 6.871094,11.890625 c 1.167968,0 2.121094,0.902344 2.207031,2.042969 0.00781,0.05859 0.00781,0.113281 0.00781,0.171875 0,1.21875 -0.992188,2.214843 -2.214844,2.214843 -1.222656,0 -2.214844,-0.992187 -2.214844,-2.214843 0,-0.05859 0.00391,-0.113281 0.00781,-0.171875 z m 2.207032,1.210937 c 0.574218,0 1.039062,-0.46875 1.039062,-1.039062 0,-0.05859 -0.00391,-0.117188 -0.011718,-0.171875 -0.082032,-0.492188 -0.511719,-0.867188 -1.027344,-0.867188 -0.515625,0 -0.941406,0.375 -1.023438,0.867188 -0.00781,0.05859 -0.015625,0.113281 -0.015625,0.171875 0,0.570312 0.464844,1.039062 1.039063,1.039062 z m 0,0" />
        
        <path d="m 6.871094,13.34375 c 0.363281,0 0.664062,0.25 0.742187,0.589844 0.011719,0.05469 0.019531,0.109375 0.019531,0.167968 0,0.417969 -0.339843,0.761719 -0.761718,0.761719 -0.417969,0 -0.761719,-0.34375 -0.761719,-0.761719 0,-0.05859 0.00781,-0.113281 0.019531,-0.167968 0.078125,-0.335938 0.382813,-0.589844 0.742188,-0.589844 z m 0,0" />
        <path d="M 20.367188,1.183594 V 0.417969 C 20.367188,0.1875 20.554688,0 20.785156,0 h 0.363282 c 0.230468,0 0.421874,0.1875 0.421874,0.417969 v 0.765625 h 0.101563 V 1.605469 H 20.261719 V 1.183594 Z m 0,0" />
        
          <path d="m 28.875,15.230469 0.632812,1.53125 h -0.394531 l -0.339843,-1.265625 0.191406,1.265625 h -0.175782 l -0.257812,-1.277344 0.109375,1.277344 h -0.179687 l -0.175782,-1.28125 0.03516,1.28125 H 28.175781 L 28,15.480469 l 0.03125,1.28125 H 27.875 l -0.128906,-1.28125 -0.01172,1.28125 h -0.144531 l -0.125,-1.28125 -0.01953,1.28125 h -0.140624 l -0.128907,-1.28125 -0.01563,1.28125 h -0.207031 l -0.01563,-1.273438 -0.128906,1.273438 h -0.144532 l -0.01562,-1.273438 -0.125,1.273438 h -0.144532 l -0.01563,-1.273438 -0.125,1.273438 h -0.15625 l 0.02734,-1.273438 -0.171875,1.273438 h -0.144531 l 0.03516,-1.273438 -0.175781,1.273438 h -0.179688 l 0.109375,-1.269531 -0.257812,1.269531 H 25.148438 L 25.339844,15.503906 25,16.761719 h -0.402344 l 0.621094,-1.53125 z m 0,0" />
        
        <path d="m 26.6875,13.054688 c 0.105469,0.210937 0.304688,0.574218 0.410156,0.769531 h 0.101563 c 0.160156,0 0.289062,0.132812 0.289062,0.300781 v 0.40625 h 1.398438 v 0.539062 H 25.21875 V 14.53125 h 1.398438 V 14.125 c 0,-0.09766 0.04687,-0.183594 0.117187,-0.238281 l -0.113281,-0.148438 c 0.101562,-0.164062 0.06641,-0.40625 0.06641,-0.683593 z m 0,0" />
        <path d="m 14.027344,14.125 v 0.40625 h 1.402344 v 0.539062 H 11.761719 V 14.53125 h 1.398437 V 14.125 c 0,-0.07422 0.02734,-0.140625 0.06641,-0.191406 h 0.738282 c 0.03906,0.05469 0.0625,0.121094 0.0625,0.191406 z m 0,0" />
        
          <path d="M 3.089844,1.546875 H 16.6875 v 8.003906 h 0.863281 V 3.542969 c 0,-1.035157 0.804688,-1.871094 1.800781,-1.871094 h 3.984376 c 0.992187,0 0.960937,0.289063 1.800781,1.871094 l 1.28125,4.617187 -0.183594,4.507813 c 0.335937,0.132812 0.453125,-0.01953 0.453125,0.375 0,0.0039 0,0.0078 0,0.0078 0,0.28125 0.03516,0.523438 -0.06641,0.683594 -0.04297,0.06641 -0.105469,0.121094 -0.203125,0.15625 v 0.04297 h -2.21875 c -0.08594,-1.324219 -1.1875,-2.367188 -2.53125,-2.367188 -1.347657,0 -2.449219,1.042969 -2.539063,2.367188 H 9.40625 C 9.316406,12.61327 8.21875,11.566395 6.871094,11.566395 c -1.34375,0 -2.445313,1.046875 -2.53125,2.367188 H 0.492188 v -9.6875 c 0,-1.492188 1.164062,-2.699219 2.597656,-2.699219 z m 15.394531,6.613281 h 6.738281 L 23.613281,2.828125 h -5.128906 z m 0,0" />

          <path d="m 15.414062,15.230469 0.632813,1.53125 H 15.65625 l -0.339844,-1.265625 0.191406,1.265625 h -0.179687 l -0.253906,-1.277344 0.109375,1.277344 h -0.179688 l -0.175781,-1.28125 0.03125,1.28125 H 14.71875 l -0.175781,-1.28125 0.03125,1.28125 h -0.15625 l -0.128907,-1.28125 -0.01562,1.28125 h -0.140626 l -0.128906,-1.28125 -0.01563,1.28125 h -0.14453 l -0.128906,-1.28125 -0.01172,1.28125 h -0.210937 l -0.01563,-1.273438 -0.125,1.273438 h -0.144531 l -0.01563,-1.273438 -0.128906,1.273438 h -0.140625 l -0.01563,-1.273438 -0.128906,1.273438 h -0.15625 l 0.03125,-1.273438 -0.175782,1.273438 h -0.140624 l 0.03125,-1.273438 -0.175782,1.273438 h -0.179687 l 0.109375,-1.269531 -0.253906,1.269531 H 11.6875 l 0.191406,-1.257813 -0.335937,1.257813 h -0.40625 l 0.621093,-1.53125 z m 0,0" />
</svg>';

    // 1. Pre-populate Default Locations (Only if empty)
    $loc_count = $wpdb->get_var("SELECT COUNT(*) FROM $loc_table");
    if ( $loc_count == 0 ) {
        $wpdb->insert($loc_table, ['name' => 'Lobby']);
        $wpdb->insert($loc_table, ['name' => 'Ballroom']);
        $wpdb->insert($loc_table, ['name' => 'Arts & Crafts']);
        $wpdb->insert($loc_table, ['name' => 'Pickleball Court']);
        $wpdb->insert($loc_table, ['name' => 'Conference Room']);
        $wpdb->insert($loc_table, ['name' => 'Bus Trip']);
        $wpdb->insert($loc_table, ['name' => 'Street']);
    }

    // 2. Pre-populate Default Categories (Only if empty)
    $cat_count = $wpdb->get_var("SELECT COUNT(*) FROM $cat_table");
    if ( $cat_count == 0 ) {
        $wpdb->insert($cat_table, ['name' => 'Brown Can', 'color_hex' => '#bc8715', 'svg_path' => "$can_icon"]);
        $wpdb->insert($cat_table, ['name' => 'Green Can', 'color_hex' => '#3cbf22', 'svg_path' => "$can_icon"]);
        $wpdb->insert($cat_table, ['name' => 'Blue Can', 'color_hex' => '#336bcd', 'svg_path' => "$can_icon"]);
        $wpdb->insert($cat_table, ['name' => 'Street Sweeper', 'color_hex' => '#b5b6c0', 'svg_path' => "$street_sweeper_icon"]);
        $wpdb->insert($cat_table, ['name' => 'HOA Board Meeting', 'color_hex' => '#0288d1']);
        $wpdb->insert($cat_table, ['name' => 'Social Event', 'color_hex' => '#ffa3a3']);
        $wpdb->insert($cat_table, ['name' => 'Commitee Meeting', 'color_hex' => '#bef8d2']);
        $wpdb->insert($cat_table, ['name' => 'Club Meeting', 'color_hex' => '#ffffff']);
    }
    // 3. Pre-populate a Sample Event
    $event_count = $wpdb->get_var("SELECT COUNT(*) FROM $event_table");
    if ( $event_count == 0 ) {

        // Fetch the IDs we just created so we can map them cleanly
        $cat_id = $wpdb->get_var("SELECT id FROM $cat_table WHERE name = 'Club Meeting'");
        $loc_id = $wpdb->get_var("SELECT id FROM $loc_table WHERE name = 'Arts & Crafts'");

        // Use WordPress's internal current_time function to respect the website's timezone settings
        $today = current_time('Y-m-d');

        // Instantiate your Repository class to use the bulletproof save() engine!
        $repo = new \HOAPLUGIN\Cal\Repository();

        $repo->save([
            'title'          => 'Sample Repeating Event',
            'content'        => 'This is a sample repeating event created during installation to show you how the calendar works. It is set to repeat every Monday, Wednesday, and Friday. <br><br><strong>To remove it:</strong> Log in as an administrator, go to the <em>HOAplugin Calendar > Event Audit Log</em> tab in your dashboard, find the blue Master Series row for this event, and click the red [x] to delete it completely.',
            'start_datetime' => $today . ' 09:00:00',
            'end_datetime'   => $today . ' 10:00:00',
            'rrule'          => 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
            'category_id'    => $cat_id,
            'location_id'    => $loc_id,
            'status'         => 'active',
            'visibility'     => 'public',
            'is_ticketed'    => 0
        ]);
    }
    // 4. Build the JSON file so the front-end can display the new sample event immediately
    $compiler = new \HOAPLUGIN\Cal\Compiler();
    $compiler->bake();
}
