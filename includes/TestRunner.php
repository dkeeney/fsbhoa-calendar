<?php
namespace FSBHOA\Cal;

class TestRunner {
    private $prefix;
    private $original_prefix;
    private $json_path;

    public function __construct($test_prefix = 'wp_test_fsb_') {
        global $wpdb;
        $this->original_prefix = $wpdb->prefix;
        $this->prefix = $test_prefix;
        $this->json_path = sys_get_temp_dir() . '/fsb_test_compiler_output.json';
    }

    /**
     * Runs the compiler and returns the 'events' array from the generated JSON.
     */
    private function run_compiler_and_get_events() {
        $compiler = new Compiler($this->prefix, $this->json_path);
        $compiler->bake();

        if (!file_exists($this->json_path)) {
            return [];
        }

        $json_content = file_get_contents($this->json_path);
        $data = json_decode($json_content, true);
        return $data['events'] ?? [];
    }

    /**
     * A simple assertion helper to keep test code clean.
     */
    private function assert($condition, $message) {
        if (!$condition) {
            return $message;
        }
        return true;
    }

    /**
     * Finds the first event in a compiled array that matches a given date.
     */
    private function find_event_by_date($events, $date) {
        foreach ($events as $event) {
            if ($event['date'] === $date) {
                return $event;
            }
        }
        return null;
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


    // --- COMPILER TESTS ---
    // The following tests validate the output of Compiler.php based on seeded DB states.

    /**
     * Tests a simple weekly series with no exceptions.
     */
    public function test_compiler_simple_series() {
        $repo = new Repository($this->prefix);
        $master_id = $repo->save([
            'title' => 'Simple Series',
            'start_datetime' => '2026-06-01 09:00:00', // A Monday
            'end_datetime' => '2026-06-01 10:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'status' => 'active'
        ]);

        $events = $this->run_compiler_and_get_events();
        
        // June 2026 has 5 Mondays.
        $result = $this->assert(count($events) === 5, "Expected 5 events for June 2026, found " . count($events));
        if ($result !== true) return $result;
        
        $first_event = $this->find_event_by_date($events, '2026-06-01');
        $result = $this->assert($first_event !== null, "Did not find event on 2026-06-01");
        if ($result !== true) return $result;

        $result = $this->assert($first_event['id'] === $master_id, "Event has wrong master ID");
        if ($result !== true) return $result;
        
        $result = $this->assert($first_event['pivot_id'] === $master_id, "Event has wrong pivot_id");
        if ($result !== true) return $result;

        $result = $this->assert($first_event['start_time'] === '09:00', "Event has wrong start_time");
        if ($result !== true) return $result;

        return true;
    }

    /**
     * Tests that a 'cancelled' child record creates a hole in the series.
     */
    public function test_compiler_series_with_hole() {
        $repo = new Repository($this->prefix);
        $master_id = $repo->save([
            'title' => 'Series with Hole',
            'start_datetime' => '2026-06-01 09:00:00', // A Monday
            'end_datetime' => '2026-06-01 10:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'status' => 'active'
        ]);
        // Add a "hole" for the second Monday
        $repo->save([
            'parent_id' => $master_id,
            'start_datetime' => '2026-06-08 09:00:00',
            'end_datetime' => '2026-06-08 10:00:00',
            'status' => 'cancelled'
        ]);
        
        $events = $this->run_compiler_and_get_events();

        $result = $this->assert(count($events) === 4, "Expected 4 events, found " . count($events));
        if ($result !== true) return $result;

        $missing_event = $this->find_event_by_date($events, '2026-06-08');
        $result = $this->assert($missing_event === null, "Found a cancelled event on 2026-06-08 that should be a hole.");
        if ($result !== true) return $result;

        return true;
    }

    /**
     * Tests that an 'active' child record out of sequence is treated as a move.
     */
    public function test_compiler_series_with_move() {
        $repo = new Repository($this->prefix);
        $master_id = $repo->save([
            'title' => 'Series with Move',
            'start_datetime' => '2026-06-01 09:00:00', // A Monday
            'end_datetime' => '2026-06-01 10:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'status' => 'active'
        ]);
        // Move the second instance from Mon Jun 8 to Tue Jun 9
        $repo->save([
            'parent_id' => $master_id,
            'start_datetime' => '2026-06-08 09:00:00', // The original spot is cancelled
            'end_datetime' => '2026-06-08 10:00:00',
            'status' => 'cancelled'
        ]);
        $move_id = $repo->save([
            'parent_id' => $master_id,
            'start_datetime' => '2026-06-09 11:00:00', // The new spot
            'end_datetime' => '2026-06-09 12:00:00',
            'status' => 'active'
        ]);

        $events = $this->run_compiler_and_get_events();
        
        $result = $this->assert(count($events) === 5, "Expected 5 total events, found " . count($events));
        if ($result !== true) return $result;

        $result = $this->assert($this->find_event_by_date($events, '2026-06-08') === null, "Found event on original move date.");
        if ($result !== true) return $result;

        $moved_event = $this->find_event_by_date($events, '2026-06-09');
        $result = $this->assert($moved_event !== null, "Did not find moved event on 2026-06-09.");
        if ($result !== true) return $result;
        
        $result = $this->assert($moved_event['move_id'] == $move_id, "Moved event missing correct move_id.");
        if ($result !== true) return $result;
        
        $result = $this->assert($moved_event['start_time'] === '11:00', "Moved event has incorrect start time.");
        if ($result !== true) return $result;

        return true;
    }

    /**
     * Tests a pivot, where the RRule changes mid-series.
     */
    public function test_compiler_series_with_pivot() {
        $repo = new Repository($this->prefix);
        $master_id = $repo->save([
            'title' => 'Pivoting Series',
            'start_datetime' => '2026-06-01 09:00:00', // Era A: Mon @ 9am
            'end_datetime' => '2026-06-01 10:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'status' => 'active'
        ]);
        $pivot_id = $repo->save([
            'parent_id' => $master_id,
            'start_datetime' => '2026-06-15 11:00:00', // Era B: Starts Jun 15, now Wed @ 11am
            'end_datetime' => '2026-06-15 12:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=WE',
            'status' => 'active'
        ]);

        $events = $this->run_compiler_and_get_events();
        
        $era_a_event = $this->find_event_by_date($events, '2026-06-08'); // Second Monday
        $result = $this->assert($era_a_event['pivot_id'] == $master_id && $era_a_event['start_time'] == '09:00', "Era A event is incorrect.");
        if ($result !== true) return $result;

        $era_b_event = $this->find_event_by_date($events, '2026-06-17'); // First Wednesday after pivot
        $result = $this->assert($era_b_event !== null, "Did not find Era B event on Wednesday 2026-06-17");
        if ($result !== true) return $result;

        $result = $this->assert($era_b_event['pivot_id'] == $pivot_id, "Era B event has wrong pivot_id");
        if ($result !== true) return $result;
        
        $result = $this->assert($era_b_event['start_time'] == '11:00', "Era B event has wrong start time");
        if ($result !== true) return $result;

        return true;
    }

    /**
     * Verifies that a single (non-recurring) event is formatted correctly.
     */
    public function test_compiler_single_event_formatting() {
        $repo = new Repository($this->prefix);
        $repo->save([
            'title' => 'Single Event',
            'start_datetime' => '2026-07-04 12:00:00',
            'end_datetime' => '2026-07-04 13:00:00',
            'status' => 'active',
            'flyer_url' => 'http://example.com/flyer.pdf'
        ]);

        $events = $this->run_compiler_and_get_events();

        $result = $this->assert(count($events) === 1, "Expected 1 event, found " . count($events));
        if ($result !== true) return $result;
        
        $event = $events[0];
        $result = $this->assert(isset($event['single']) && $event['single'] === true, "Single event missing 'single: true' flag.");
        if ($result !== true) return $result;

        $result = $this->assert($event['flyer_url'] === 'http://example.com/flyer.pdf', "Flyer URL mismatch.");
        if ($result !== true) return $result;
        
        return true;
    }

    /**
     * Tests a "Triple-Exception": moving an already-moved instance.
     */
    public function test_compiler_triple_exception() {
        global $wpdb;
        $repo = new Repository($this->prefix);

        // 1. A weekly series on Mondays at 9am
        $master_id = $repo->save([
            'title' => 'Triple-X Yoga',
            'start_datetime' => '2026-06-01 09:00:00', // A Monday
            'end_datetime' => '2026-06-01 10:00:00',
            'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'status' => 'active'
        ]);

        // 2. First move: Mon, Jun 8 @ 9am  ->  Tue, Jun 9 @ 11am
        $repo->move_event_instance(
            $master_id,
            $master_id, // pivot_id is the master
            null,        // no existing move_id
            '2026-06-08',
            '2026-06-09',
            '11:00',
            '12:00'
        );

        // Find the ID of the newly created 'move' record
        $first_move_id = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->prefix}fsbhoa_events WHERE parent_id = %d AND status = 'active' AND DATE(start_datetime) = %s",
            $master_id,
            '2026-06-09'
        ));
        if (!$first_move_id) return "Failed to create the first move record.";

        // 3. Second move (The Triple-Exception): Tue, Jun 9 @ 11am  ->  Wed, Jun 10 @ 1pm
        $repo->move_event_instance(
            $master_id,
            $master_id,
            $first_move_id, // We are moving the record we just created
            '2026-06-09',    // The date we are moving FROM
            '2026-06-10',    // The date we are moving TO
            '13:00',
            '14:00'
        );

        // 4. Run compiler and verify
        $events = $this->run_compiler_and_get_events();

        // Check total count for June. Still 5 Mondays worth of events.
        $june_events = array_filter($events, function($e) {
            return strpos($e['date'], '2026-06-') === 0;
        });
        $result = $this->assert(count($june_events) === 5, "Expected 5 total events in June, found " . count($june_events));
        if ($result !== true) return $result;

        // Verify holes
        $result = $this->assert($this->find_event_by_date($events, '2026-06-08') === null, "Found event on original date (should be a hole).");
        if ($result !== true) return $result;
        
        $result = $this->assert($this->find_event_by_date($events, '2026-06-09') === null, "Found event on intermediate move date (should be gone).");
        if ($result !== true) return $result;

        // Verify final location
        $final_event = $this->find_event_by_date($events, '2026-06-10');
        $result = $this->assert($final_event !== null, "Did not find event on final move date 2026-06-10.");
        if ($result !== true) return $result;

        // Verify final event's data integrity
        $result = $this->assert($final_event['start_time'] === '13:00', "Final event has wrong start time.");
        if ($result !== true) return $result;

        $result = $this->assert($final_event['id'] == $master_id, "Final event has wrong master ID.");
        if ($result !== true) return $result;

        $result = $this->assert($final_event['pivot_id'] == $master_id, "Final event has wrong pivot_id.");
        if ($result !== true) return $result;
        
        // The key assertion: the move_id must match the record that was updated.
        $result = $this->assert(isset($final_event['move_id']) && $final_event['move_id'] == $first_move_id, "Final event has incorrect move_id. Expected {$first_move_id}, got " . ($final_event['move_id'] ?? 'null'));
        if ($result !== true) return $result;

        return true;
    }

    public function cleanup() {
        global $wpdb;
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}fsbhoa_events");
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}fsbhoa_categories");
        $wpdb->query("DROP TABLE IF EXISTS {$this->prefix}fsbhoa_locations");

        if (file_exists($this->json_path)) {
            unlink($this->json_path);
        }
    }
}


