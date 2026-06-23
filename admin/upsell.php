<?php
if ( ! defined( 'ABSPATH' ) ) exit;

// 1. Inject the Upsell Tab
add_action('hoa_calendar_extra_tabs', 'hoa_render_upsell_tab', 10, 1);
function hoa_render_upsell_tab($active_tab) {
    // THE ABORT SWITCH: Check if Pro is loaded right before drawing the tab
    if ( function_exists('hoa_render_pro_license_tab') ) {
        return;
    }

    ?>
    <a href="?page=hoa-cal-settings&tab=upgrade" class="nav-tab <?php echo $active_tab == 'upgrade' ? 'nav-tab-active' : ''; ?>" style="color: #2271b1; font-weight: bold;">Upgrade to Pro ⭐</a>
    <?php
}

// 2. Render the Upsell Content
add_action('hoa_calendar_extra_tab_content', 'hoa_render_upsell_content', 10, 1);
function hoa_render_upsell_content($active_tab) {
    if ( $active_tab !== 'upgrade' ) return;

    // THE ABORT SWITCH: Check if Pro is loaded right before drawing the content
    if ( function_exists('hoa_render_pro_license_tab') ) {
        return;
    }
    ?>
    <div class="card" style="max-width: 800px; padding: 30px; text-align: center;">
        <h2 style="font-size: 2em; margin-bottom: 10px;">Unlock the Power of Pro</h2>
        <p style="font-size: 1.2em; color: #555;">Take your community calendar to the next level with premium features.</p>
        
        <ul style="text-align: left; display: inline-block; font-size: 1.1em; margin: 20px 0; line-height: 1.8;">
            <li>✅ <strong>Drag-and-Drop reschedule:</strong> Move events by dragging to new day.</li>
            <li>✅ <strong>Drag-and-Drop canell:</strong> Cancel event by dragging out of calendar.</li>
            <li>✅ <strong>Tabloid Printing:</strong> Export 11x17 decorated calendars for newsletter.</li>
            <li>✅ <strong>Priority Support:</strong> Direct help when you need it.</li>
            <li>✅ <strong>Feature updates:</strong> keep up with latest changes.</li>
        </ul><br>
        
        <a href="https://hoaplugin.com/" target="_blank" class="button button-primary button-hero" style="background: #2271b1; border-color: #2271b1;">Get HOAPLUGIN Calendar Pro</a>
    </div>
    <?php
}
