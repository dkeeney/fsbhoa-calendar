<?php
namespace FSBHOA\Cal;

class TestRunner {
    private $prefix;
    private $original_prefix;

    public function __construct($test_prefix = 'wp_test_fsb_') {
        global $wpdb;
        $this->original_prefix = $wpdb->prefix;
        $this->prefix = $test_prefix;
    }

    /**
     * Clones the table structure for the sandbox
     */
    public function bootstrap() {
        global $wpdb;
        $tables = ['fsbhoa_events', 'fsbhoa_categories', 'fsbhoa_locations'];
        
        foreach ($tables as $t) {
            $old = $this->original_prefix . $t;
            $new = $this->prefix . $t;
            $wpdb->query("DROP TABLE IF EXISTS $new");
            $wpdb->query("CREATE TABLE $new LIKE $old");
        }
        
        // Seed default location/category for testing
        $wpdb->insert($this->prefix . 'fsbhoa_locations', ['id' => 1, 'name' => 'Test Lodge']);
        $wpdb->insert($this->prefix . 'fsbhoa_categories', ['id' => 1, 'name' => 'General', 'color_hex' => '#3498db']);
        
        return $this->prefix;
    }

    /**
     * Logic for Scenario: The Boomerang Move
     *   reschedule an instance of a repeating sequence.
     *   reschedule it back to the original date/time.
     *   It should revert to the original sequence with no holes or move records.
     */
    public function test_boomerang() {
        global $wpdb;
        // 1. Create a Master One-Shot
        $repo = new Repository($this->prefix);
        $id = $repo->save([
            'title' => 'Boomerang Test',
            'start_datetime' => '2026-06-01 10:00:00',
            'end_datetime' => '2026-06-01 11:00:00',
            'status' => 'active'
        ]);

        // 2. Move it
        $repo->move_event_instance($id, $id, null, '2026-06-01', '2026-06-02', '10:00', '11:00');
        
        // 3. Move it back to original slot
        $repo->move_event_instance($id, $id, null, '2026-06-02', '2026-06-01', '10:00', '11:00');

        // 4. Verify Master is back to normal and no children exist
        $master = $repo->get($id);
        $children = $wpdb->get_var("SELECT COUNT(*) FROM {$this->prefix}fsbhoa_events WHERE parent_id = $id");

        if ($master->start_datetime !== '2026-06-01 10:00:00') return "Master datetime desync";
        if ($children > 0) return "Orphaned child records found";
        
        return true;
    }

    /* When a pivot occurs at an instance, all downstream exceptions (holes and moves) 
     * are removed.
     */
    public function test_pivot_cleanup() {
        global $wpdb;
        $repo = new Repository($this->prefix);

        // 1. Seed a Weekly Series at 9 AM
        $master_id = $repo->save([
            'title' => 'Yoga Class',
            'start_datetime' => '2026-06-01 09:00:00',
            'end_datetime' => '2026-06-01 10:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'status' => 'active'
        ]);

        // 2. Add an exception (a Move) for the second week
        $repo->move_event_instance($master_id, $master_id, null, '2026-06-08', '2026-06-08', '11:00', '12:00');

        // 3. Pivot the series to 10 AM starting June 1st (Update In-Place)
        $dna_data = [
            'title' => 'Yoga Class',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'start_datetime' => '2026-06-01 10:00:00',
            'end_datetime' => '2026-06-01 11:00:00'
        ];
        $repo->maybe_pivot_series($master_id, $dna_data, '2026-06-01');

        // 4. Verification: The move on June 8th (at 9am slot) should be gone
        $exception_count = $wpdb->get_var("SELECT COUNT(*) FROM {$this->prefix}fsbhoa_events WHERE parent_id = $master_id");

        if ($exception_count > 0) return "Failed to clean up downstream exceptions after pivot.";

        return true;
    }

    public function test_leapfrog() {
        $repo = new Repository($this->prefix);

        // 1. Create Master (Era A: 8 AM)
        $master_id = $repo->save([
            'title' => 'Early Bird',
            'start_datetime' => '2026-05-01 08:00:00',
            'end_datetime' => '2026-05-01 09:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=FR',
            'status' => 'active'
        ]);

        // 2. Create Pivot (Era B: 10 AM starting June 1)
        $repo->save([
            'parent_id' => $master_id,
            'title' => 'Late Bird',
            'start_datetime' => '2026-06-01 10:00:00',
            'end_datetime' => '2026-06-01 11:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=FR',
            'status' => 'active'
        ]);

        // 3. Move an instance from May (Era A) into June (Era B calendar space)
        // This is a 'Leapfrog' because the Move record start_date is > Pivot start_date
        $repo->move_event_instance($master_id, $master_id, null, '2026-05-22', '2026-06-15', '08:00', '09:00');

        // Validation: Verify the move exists and has the correct parent
        $repo_move = $repo->get_all_active(); // Just a simple check to see if it's there
        if (count($repo_move) < 3) return "Leapfrog move record not found or improperly linked.";

        return true;
    }


    public function cleanup() {
        global $wpdb;
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}fsbhoa_events");
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}fsbhoa_categories");
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}fsbhoa_locations");
    }
}


