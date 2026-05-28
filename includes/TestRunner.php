<?php
namespace FSBHOA\Cal;

class TestRunner {
    private $test_prefix;
    private $json_path;
    private $json_url;
    private $repo;

    public function __construct($test_prefix = 'wp_test_fsb_') {
        global $wpdb;
        $this->test_prefix = $wpdb->prefix . 'test_';
        // Set the test JSON path to the uploads folder for easy debugging
        $upload_dir = wp_upload_dir();
        $this->json_path = $upload_dir['basedir'] . '/fsbhoa-calendar/test_calendar-events.json';
        // The HTTP URL for Playwright/Frontend to fetch the file.
        $this->json_url = $upload_dir['baseurl'] . '/fsbhoa-calendar/test_calendar-events.json';
        $this->repo = new Repository($this->test_prefix);
    }

    public function get_prefix() {
        return $this->test_prefix;
    }
    public function get_json_url() {
        return $this->json_url;
    }

    /**
     * Finds all methods starting with 'test_' to feed to the Admin Dashboard
     * This is for the backend tests.
     */
    public function get_test_scenarios() {
        $methods = get_class_methods($this);
        $scenarios = [];
        foreach ($methods as $method) {
            if (strpos($method, 'test_') === 0) {
                $scenarios[] = substr($method, 5);
            }
        }
        return $scenarios;
    }

    /**
     * Executes a single backend test suite from the Admin Dashboard.
     */
    public function run_test_scenario($slug) {
        $method = "test_" . $slug;
        if (!method_exists($this, $method)) {
            return ['success' => false, 'message' => "Test method not found."];
        }

        try {
            //  Act & Assert: Run the specific test
            $this->$method();

            return ['success' => true, 'message' => "Passed"];
        } catch (\Exception $e) {
            // If any assertion fails, it throws an Exception caught here
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function load_fixture($fixture_data) {
        // 1. Delegate the database work to the Repository
        $id_map = $this->repo->load_fixture($fixture_data);

        // 2. Bake the JSON file for the frontend to consume
        $compiler = new \FSBHOA\Cal\Compiler($this->test_prefix, $this->json_path);
        $compiler->bake();

        return $id_map;
    }

    public function cleanup() {
        // 1. Delegate database wiping to the Repository
        $this->repo->cleanup_test_tables($this->test_prefix);

        // Clean up the physical test JSON file
        if (file_exists($this->json_path)) {
            unlink($this->json_path);
        }

        return true;
    }

    public function get_db_state($master_id) {
        $family = $this->repo->get_event_family($master_id);

        return [
            'master' => $family['master'],
            'children' => $family['children'],
            'total_children' => count($family['children']),
            'child_dates' => array_map(function($child) {
                return [
                    'id' => $child->id,
                    'date' => date('Y-m-d', strtotime($child->start_datetime)),
                    'status' => $child->status
                ];
            }, $family['children'])
        ];
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================
    /**
     * Runs the compiler and returns the 'events' array from the generated JSON.
     */
    private function run_compiler_and_get_events() {
        $compiler = new Compiler($this->test_prefix, $this->json_path);
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
    private function assert($condition, $fail_message) {
        if (!$condition) {
            throw new \Exception($fail_message);
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
     * Helper to find a specific child record (like a move or a hole) by its date
     * Uses pure Repository methods instead of raw SQL!
     */
    private function get_child_id_by_date($master_id, $date_str) {
        $family = $this->repo->get_event_family($master_id);
        foreach ($family['children'] as $child) {
            if (strpos($child->start_datetime, $date_str) === 0) {
                return $child->id;
            }
        }
        return null;
    }

    // =========================================================================
    // THE BACKEND TESTS
    // =========================================================================

    /**
     * Logic for Scenario: The Boomerang Move
     * Tests moving an instance away and back to its natural slot.
     * Verifies that temporary holes and move records are perfectly cleaned up.
     */
    public function test_boomerang() {
        $ids = $this->load_fixture([
            'events' => [
                ['_ref' => 'master', 'title' => 'Yoga', 'start_date' => '2026-06-01', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO'],
                ['_ref' => 'pivot', 'parent_ref' => 'master', 'title' => 'Yoga', 'start_date' => '2026-06-17', 'start_time' => '10:00:00', 'end_time' => '11:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=WE']
            ]
        ]);
        $master_id = $ids['master'];
        $pivot_id = $ids['pivot'];

        // --- EDGE CASE 1: Boomerang a Natural Instance (Era A) ---
        $this->repo->move_event_instance($master_id, $master_id, null, '2026-06-08', '2026-06-09', '09:00', '10:00');
        $move_1_id = $this->get_child_id_by_date($master_id, '2026-06-09');
        $this->repo->move_event_instance($master_id, $master_id, $move_1_id, '2026-06-09', '2026-06-08', '09:00', '10:00');

        // --- EDGE CASE 2: Boomerang a Post-Pivot Natural Instance (Era B) ---
        $this->repo->move_event_instance($master_id, $pivot_id, null, '2026-06-24', '2026-06-25', '10:00', '11:00');
        $move_2_id = $this->get_child_id_by_date($master_id, '2026-06-25');
        $this->repo->move_event_instance($master_id, $pivot_id, $move_2_id, '2026-06-25', '2026-06-24', '10:00', '11:00');

        // --- EDGE CASE 3: Boomerang the Pivot Instance Itself ---
        $this->repo->move_event_instance($master_id, $pivot_id, null, '2026-06-17', '2026-06-18', '10:00', '11:00');
        $move_3_id = $this->get_child_id_by_date($master_id, '2026-06-18');
        $this->repo->move_event_instance($master_id, $pivot_id, $move_3_id, '2026-06-18', '2026-06-17', '10:00', '11:00');

        $state = $this->get_db_state($master_id);

        $this->assert($state['total_children'] === 1, "Boomerang failed. Expected 1 child (the pivot), found " . $state['total_children']);
        $this->assert($state['children'][0]->id == $pivot_id, "The remaining child is not the pivot!");
    }



    /* When a pivot occurs at an instance, all downstream exceptions (holes and moves) 
     * are removed.
     */
    public function test_pivot_cleanup() {
        $ids = $this->load_fixture([
            'events' => [
                ['_ref' => 'master', 
                  'title' => 'Yoga Class', 
                  'start_date' => '2026-06-01', 
                  'start_time' => '09:00:00', 
                  'end_time' => '10:00:00', 
                  'rrule' => 'FREQ=WEEKLY;BYDAY=MO'],
                ['parent_ref' => 'master', 
                  'title' => 'Yoga Hole', 
                  'start_date' => '2026-06-08', 
                  'start_time' => '09:00:00', 
                  'end_time' => '10:00:00', 
                  'status' => 'cancelled'],
                ['parent_ref' => 'master', 
                  'title' => 'Yoga Move', 
                  'start_date' => '2026-06-08', 
                  'start_time' => '11:00:00', 
                  'end_time' => '12:00:00', 
                  'status' => 'active'
                ]
            ]
        ]);
        $master_id = $ids['master'];

        $dna_data = [
            'title' => 'Yoga Class', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO',
            'start_datetime' => '2026-06-01 10:00:00', 'end_datetime' => '2026-06-01 11:00:00'
        ];
        $this->repo->maybe_pivot_series($master_id, $dna_data, '2026-06-01');

        $state = $this->get_db_state($master_id);
        $this->assert($state['total_children'] === 0, "Failed to clean up downstream exceptions after pivot.");
    }

    public function test_leapfrog() {
        $ids = $this->load_fixture([
            'events' => [
                ['_ref' => 'era_a', 'title' => 'Early Bird', 'start_date' => '2026-05-01', 'start_time' => '08:00:00', 'end_time' => '09:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=FR'],
                ['_ref' => 'era_b', 'parent_ref' => 'era_a', 'title' => 'Late Bird', 'start_date' => '2026-06-01', 'start_time' => '10:00:00', 'end_time' => '11:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=FR']
            ]
        ]);

        $this->repo->move_event_instance($ids['era_a'], $ids['era_a'], null, '2026-05-22', '2026-06-15', '08:00', '09:00');

        $state = $this->get_db_state($ids['era_a']);
        $this->assert($state['total_children'] >= 2, "Leapfrog move record missing or improperly linked.");
    }


    // --- COMPILER TESTS ---
    // The following tests validate the output of Compiler.php based on seeded DB states.

    /**
     * Tests a simple weekly series with no exceptions.
     */
    public function test_compiler_simple_series() {
        $ids = $this->load_fixture([
            'events' => [['_ref' => 'master', 'title' => 'Simple Series', 'start_date' => '2026-06-01', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO']]
        ]);

        $events = $this->run_compiler_and_get_events();
        $june_events = array_filter($events, function($e) { return strpos($e['date'], '2026-06-') === 0; });

        $this->assert(count($june_events) === 5, "Expected 5 events for June 2026, found " . count($june_events));

        $first = $this->find_event_by_date($events, '2026-06-01');
        $this->assert($first !== null, "Did not find event on 2026-06-01");
        $this->assert($first['id'] == $ids['master'], "Event has wrong master ID");
    }

    /**
     * Tests that a 'cancelled' child record creates a hole in the series.
     */
    public function test_compiler_series_with_hole() {
        $this->load_fixture([
            'events' => [
                ['_ref' => 'master', 'title' => 'Series', 'start_date' => '2026-06-01', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO'],
                ['parent_ref' => 'master', 'title' => 'Hole', 'start_date' => '2026-06-08', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'status' => 'cancelled']
            ]
        ]);
        
        $events = $this->run_compiler_and_get_events();

        $june_events = array_filter($events, function($e) {
            return strpos($e['date'], '2026-06-') === 0;
        });

        $result = $this->assert(count($june_events) === 4, "Expected 4 events, found " . count($june_events));
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
        // 1. Seed the DB using the Fixture Engine
        $ids = $this->load_fixture([
            'events' => [
                // The Master Series (Mondays at 9am)
                ['_ref' => 'master', 'title' => 'Series with Move', 'start_date' => '2026-06-01', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO'],
                // The Hole (Cancel the second Monday)
                ['parent_ref' => 'master', 'title' => 'Hole', 'start_date' => '2026-06-08', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'status' => 'cancelled'],
                // The Move (Reschedule it to Tuesday at 11am)
                ['_ref' => 'move_id', 'parent_ref' => 'master', 'title' => 'Move', 'start_date' => '2026-06-09', 'start_time' => '11:00:00', 'end_time' => '12:00:00', 'status' => 'active']
            ]
        ]);

        // 2. Compile and fetch
        $events = $this->run_compiler_and_get_events();

        $june_events = array_filter($events, function($e) {
            return strpos($e['date'], '2026-06-') === 0;
        });

        // 3. Assertions
        $this->assert(count($june_events) === 5, "Expected 5 total events, found " . count($june_events));

        $this->assert($this->find_event_by_date($events, '2026-06-08') === null, "Found event on original move date (should be a hole).");

        $moved_event = $this->find_event_by_date($events, '2026-06-09');
        $this->assert($moved_event !== null, "Did not find moved event on 2026-06-09.");

        $this->assert($moved_event['move_id'] == $ids['move_id'], "Moved event missing correct move_id. Expected " . $ids['move_id']);
        $this->assert($moved_event['start_time'] === '11:00', "Moved event has incorrect start time.");
    }

    /**
     * Tests a pivot, where the RRule changes mid-series.
     * Verifies that the Compiler correctly maps instances to their respective Eras.
     */
    public function test_compiler_series_with_pivot() {
        // 1. Seed the DB using the Fixture Engine
        $ids = $this->load_fixture([
            'events' => [
                // Era A: Master Series (Mondays @ 9am)
                ['_ref' => 'master', 'title' => 'Pivoting Series', 'start_date' => '2026-06-01', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO'],
                // Era B: Pivot (Starts Jun 15, now Wed @ 11am)
                ['_ref' => 'pivot', 'parent_ref' => 'master', 'title' => 'Pivoting Series', 'start_date' => '2026-06-15', 'start_time' => '11:00:00', 'end_time' => '12:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=WE']
            ]
        ]);

        // 2. Compile and fetch
        $events = $this->run_compiler_and_get_events();

        // --- Assertions for Era A ---
        $era_a_event = $this->find_event_by_date($events, '2026-06-08'); // Second Monday
        $this->assert($era_a_event !== null, "Did not find Era A event on Monday 2026-06-08.");
        $this->assert($era_a_event['pivot_id'] == $ids['master'], "Era A event has incorrect pivot_id. Expected " . $ids['master']);
        $this->assert($era_a_event['start_time'] === '09:00', "Era A event has incorrect start time.");

        // --- Assertions for Era B ---
        $era_b_event = $this->find_event_by_date($events, '2026-06-17'); // First Wednesday after pivot
        $this->assert($era_b_event !== null, "Did not find Era B event on Wednesday 2026-06-17.");
        $this->assert($era_b_event['pivot_id'] == $ids['pivot'], "Era B event has wrong pivot_id. Expected " . $ids['pivot']);
        $this->assert($era_b_event['start_time'] === '11:00', "Era B event has wrong start time.");
    }


    /**
     * Tests a "Triple-Exception": moving an already-moved instance.
     * Ensures that moving an existing exception updates the record rather than creating a duplicate.
     */
    public function test_compiler_triple_exception() {
        // 1. Seed the DB using the Fixture Engine
        $ids = $this->load_fixture([
            'events' => [
                // A weekly series on Mondays at 9am
                ['_ref' => 'master', 'title' => 'Triple-X Yoga', 'start_date' => '2026-06-01', 'start_time' => '09:00:00', 'end_time' => '10:00:00', 'rrule' => 'FREQ=WEEKLY;BYDAY=MO']
            ]
        ]);
        $master_id = $ids['master'];

        // 2. First move: Mon, Jun 8 @ 9am  ->  Tue, Jun 9 @ 11am
        $this->repo->move_event_instance(
            $master_id,
            $master_id, // pivot_id is the master
            null,       // no existing move_id
            '2026-06-08',
            '2026-06-09',
            '11:00',
            '12:00'
        );

        // Find the ID of the newly created 'move' record using our clean helper!
        $first_move_id = $this->get_child_id_by_date($master_id, '2026-06-09');
        $this->assert($first_move_id !== null, "Failed to create the first move record.");

        // 3. Second move (The Triple-Exception): Tue, Jun 9 @ 11am  ->  Wed, Jun 10 @ 1pm
        $this->repo->move_event_instance(
            $master_id,
            $master_id,
            $first_move_id,  // We are moving the record we just created
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
        $this->assert(count($june_events) === 5, "Expected 5 total events in June, found " . count($june_events));

        // Verify holes and cleaned-up intermediates
        $this->assert($this->find_event_by_date($events, '2026-06-08') === null, "Found event on original date (should be a hole).");
        $this->assert($this->find_event_by_date($events, '2026-06-09') === null, "Found event on intermediate move date (should be gone).");

        // Verify final location
        $final_event = $this->find_event_by_date($events, '2026-06-10');
        $this->assert($final_event !== null, "Did not find event on final move date 2026-06-10.");

        // Verify final event's data integrity
        $this->assert($final_event['start_time'] === '13:00', "Final event has wrong start time.");
        $this->assert($final_event['id'] == $master_id, "Final event has wrong master ID.");
        $this->assert($final_event['pivot_id'] == $master_id, "Final event has wrong pivot_id.");

        // The key assertion: the move_id must match the original record that was updated.
        $this->assert(isset($final_event['move_id']) && $final_event['move_id'] == $first_move_id, "Final event has incorrect move_id. Expected {$first_move_id}, got " . ($final_event['move_id'] ?? 'null'));
    }


    /**
     * Verifies that a single (non-recurring) event is formatted correctly.
     */
    public function test_compiler_single_event_formatting() {
        // 1. Seed the DB using the Fixture Engine
        $this->load_fixture([
            'events' => [
                [
                    '_ref' => 'single',
                    'title' => 'Single Event',
                    'start_date' => '2026-07-04',
                    'start_time' => '12:00:00',
                    'end_time' => '13:00:00',
                    'status' => 'active',
                    // Note: Ensure your Repository->load_fixture() method maps this!
                    'flyer_url' => 'http://example.com/flyer.pdf'
                ]
            ]
        ]);

        // 2. Compile and fetch
        $events = $this->run_compiler_and_get_events();

        // 3. Assertions
        $this->assert(count($events) === 1, "Expected 1 event, found " . count($events));

        $event = $events[0];
        $this->assert(isset($event['single']) && $event['single'] === true, "Single event missing 'single: true' flag.");
        $this->assert(isset($event['flyer_url']) && $event['flyer_url'] === 'http://example.com/flyer.pdf', "Flyer URL mismatch.");
    }



}


