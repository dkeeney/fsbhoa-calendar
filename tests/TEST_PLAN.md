FSBHOA Calendar: Frontend E2E Test Specification

## 1. Overview: The Hybrid Testing Pyramid
The FSBHOA Calendar uses a custom "Hybrid" testing architecture. Because recurrence logic (Pivots, Holes, Moves) is highly complex, we test it at two distinct layers using a single unified test engine (`TestRunner.php`).

1. **Backend Integration Tests (PHP):** Lightning-fast tests that verify the `Repository` and `Compiler` can correctly generate, move, pivot, and bake complex event sequences into JSON without a browser.
2. **End-to-End (E2E) UI Tests (Playwright):** Automated browser tests that verify the JavaScript drag-and-drop UI, hover states, and modal forms interact correctly with the backend APIs.

Both layers share the exact same sandbox environment and Fixture Engine.

---

## 2. The Sandbox Environment (Safety First)
To ensure production community data is **never** touched during testing, the engine employs a strict sandboxing protocol:

* **Prefixing:** All tests run against tables prefixed with `wp_test_fsbhoa_` rather than the live prefix.
* **Schema Cloning:** `Repository->prepare_test_tables()` automatically clones the live table schema so tests always run against the current production structure.
* **Isolated JSON:** The compiler bakes test output to a dedicated `test_calendar-events.json` file in the WP uploads directory, leaving the live frontend untouched.
* **Auto-Teardown:** `TestRunner->cleanup()` safely truncates the `test_` tables and deletes the test JSON file when tests complete.

---

## 3. The Fixture Engine
Setting up complex repeating calendar states manually is brittle. We use a custom Fixture Engine (`Repository->load_fixture()`) to seed the database instantly using simple JSON/Array payloads.

* **Relative Dating:** Instead of hardcoding dates, the engine parses relative strings (e.g., `+1 day`) or specific dates to ensure tests don't expire.
* **Reference Mapping (`_ref`):** Records can be assigned a temporary `_ref` (e.g., `'_ref' => 'master'`). The engine tracks MySQL insert IDs and automatically maps them to foreign keys (`'parent_ref' => 'master'`), eliminating ID guessing.
* **Schema Complete:** Automatically handles metadata fields like `color_hex`, `flyer_url`, `setup_notes`, and `visibility`.

---

## 4. System Overview & Architecture
The frontend controls a monthly calendar view displayed as a grid of day cells.
*   **Visual Layer:** A custom Canva-designed background element containing the month and year sits behind the transparent grid layer (maintaining a strict 11x17 aspect ratio).
*   **Data Pipeline:** Dynamic cell population is driven by `calendar-events.json`. During runtime, event instances are loaded into memory inside `window.allEvents` via `loadData()`.
*   **Grid Edge Cases (Split Cells):** To fit 30/31-day months into 5 rows, cascading dates split diagonally (top-right/bottom-left) on either the first Saturday or the last Sunday. 
*   **Interaction Model (The Magnifier):** Moving the cursor over a day cell triggers a visual magnification. **Crucial for Playwright:** All structural interactions (accessing modals, dragging elements, clicking icons) *must* be executed on the `.magnified` DOM state of the active cell.

---

## 5. End-to-End Test Suites (Playwright)

### TEST 1: Grid Rendering & Data Integrity
*   **Scenario:** Verify the layout engine maps JSON data to the correct DOM nodes.
*   **Assertions:** 
    *   Confirm event titles, chronological order, start/end times, and category styling align perfectly with the backend JSON configuration for the active month.
    *   Confirm day headers correctly position at the top for standard/top-split cells, and at the bottom for bottom-split cells.

### TEST 2: Admin Creation Engine (Add Event)
*   **Scenario:** Verify the presence and initialization of the Add icon (`+`).
*   **Assertions:**
    *   Confirm the `+` icon is *only* visible in the magnified day header for authenticated Administrators.
    *   Clicking the `+` icon opens the Edit Modal initialized to that exact target date.
    *   Verify the *Reschedule* and *Cancel Event* buttons are completely absent in this creation context.

### TEST 3: Day Modal Navigation & Split Cell Boundary Logic
*   **Scenario:** Access the Day Modal by clicking the day number inside a magnified cell.
*   **Execution Strategy:** Target these specific boundaries:
    1.  The first day of the current month.
    2.  A random standard day in the middle of the month.
    3.  The absolute last day of the month.
    4.  The top half of a split cell (requires a month with a split first Saturday).
    5.  The bottom half of a split cell (requires a month with a split last Sunday).
*   **Assertions:** Confirm `#fsb-day-modal` gains `.is-visible` and strictly renders only the instances mapped to that exact date.

### TEST 4: Detail Modal & Flyer Routing
*   **Scenario:** Access event details by clicking an instance title or category icon in the magnified cell.
*   **Assertions:**
    *   *Icon Click:* Clicking an event icon in the day header triggers the detail flow.
    *   *Title Click:* Clicking the text title in the cell body triggers the detail flow.
    *   *Flyer Bypass:* If `flyer_url` exists, the click must bypass the modal and open the asset in a new tab.
    *   *Modal Fallback:* If no flyer exists, the `#fsb-detail-modal` opens and accurately displays metadata from the master record.

### TEST 5: Administrative Context UI (Edit Pencils)
*   **Scenario:** Verify contextual UI decorations match user capabilities (Admin vs. Delegate vs. Guest).
*   **Assertions:**
    *   Confirm a pencil icon appears adjacent to day-header category icons *only* for authorized users.
    *   Confirm a pencil icon is appended to the trailing edge of standard event titles inside the magnified cell *only* for authorized users.
    *   Clicking either pencil successfully initializes the Edit Modal for that specific instance.

### TEST 6: Edit Modal & RRule Compiler Engine
*   **Scenario:** Deep-test form population, lookup relationships, state switches, and the RRule compiler.
*   **Assertions:**
    *   **Data Integrity:** Fields auto-populate with metadata from the Master and DNA data from the most recent `pivot_id`.
    *   **Dropdowns:** *Location* and *Category* dropdowns accurately populate from `fsbhoa_locations` and `fsbhoa_categories`.
    *   **State Toggles:** Toggling *Public/Residents Only* updates the visibility attribute. Toggling *Requires Tickets* contextually displays the pricing input.
    *   **RRule Bi-Directional Parsing:**
        *   Toggling from repeating to single-instance entirely clears the RRule string.
        *   Toggling from single to repeating initializes an RRule built from the UI selectors.
        *   Loading an event with a pre-existing RRule successfully reverse-engineers the string and checks the correct UI builder toggles.
        *   Manually altering a UI builder field immediately recalculates the raw text in the Manual RRULE block.
    *   **DNA Mutation Routing (UI Trigger -> Backend Expectation):**
        *   *Master Match:* Edits modify the master and clear downstream exceptions.
        *   *Pivot Match:* Edits modify the existing pivot and clear downstream exceptions.
        *   *Mid-Stream Edit:* Creates a *new* pivot lineage and clears downstream exceptions.
    *   **Form Submission:** Clicking *Save* executes the async fetch request cleanly.

### TEST 7: Event Deletion Framework (Single Instances)
*   **Scenario:** Trigger cancellation on a standard, non-repeating event.
*   **Assertions:** Clicking *Cancel Event* routes to a management modal displaying only one option: `Delete Event Forever`.

### TEST 8: Event Deletion Framework (Recurring Series)
*   **Scenario:** Trigger cancellation on an active recurring sequence instance.
*   **Assertions:** Clicking *Cancel Event* displays the full four-part management array:
    1.  `Cancel ONLY this Instance` (Injects Hole exception).
    2.  `Restore or undelete next cancelled instance` (Deletes next Hole).
    3.  `End series starting today` (Appends `UNTIL` to current pivot).
    4.  `DELETE ENTIRE SERIES & HISTORY` (Purges Master and all children).

### TEST 9: Reschedule Modal Interface
*   **Scenario:** Interact with the manual `#fsb-reschedule-modal` frame.
*   **Assertions:**
    *   *Single Event:* Submitting new Date/Time directly modifies the Master.
    *   *Repeating Event:* Submitting prompts the user to select `Only this specific instance` (Move) or `This and all future instances` (Pivot). Verify both selections alter the generated JSON output appropriately.

### TEST 10: Drag-and-Drop Rescheduling (The Boomerang Test)
*   **Scenario:** Test pointer-driven interaction states on the calendar grid canvas.
*   **Assertions:**
    *   Dragging an event chip to an open day cell registers an async `instance_move` payload.
    *   Dragging an *already moved* exception to a new cell modifies the existing Move record rather than compounding duplicates.
    *   **The Boomerang:** Dragging a moved instance *back* to its original natural position successfully deletes both the Hole exception and the Move tracking record, restoring the natural series.

### TEST 11: Shift-Modifier Drag-and-Drop (Pivots)
*   **Scenario:** Drag an element while continuously holding the `Shift` key.
*   **Assertions:** Dropping the element automatically triggers an integrated series Pivot operation, adjusting the active target day and all downstream instances without creating standalone Move/Hole records.

### TEST 12: Context Highlighting & Viewport Anchors
*   **Scenario:** Verify temporal positioning aids.
*   **Assertions:**
    *   The day cell matching the real-world system timestamp is highlighted via the active CSS class.
    *   Clicking *Today* in the bottom global toolbar instantly redirects the viewport to the current month and day.

### TEST 13: Temporal State Lockdowns (Past vs. Future)
*   **Scenario:** Verify rules governing historical calendar frames.
*   **Assertions:** All day cells representing dates prior to the current system date are explicitly grayed out visually.

### TEST 14: Edge Case - Form Validator (Happy Path)
*   **Scenario:** Attempt to save with invalid form data.
*   **Assertions:** Emptying the required *Title* text field and clicking *Save* aborts the operation, leaving the database untouched.

### TEST 15: Edge Case - The Void Drop (Unhappy Path)
*   **Scenario:** Misdirect a drag-and-drop pointer stream.
*   **Assertions:** Dragging an event chip completely outside the grid matrix (e.g., page header) and releasing it triggers a graceful abort. The element snaps back to origin with no database mutations or JavaScript console faults.

### TEST 16: Edge Case - The Time Traveler Lockdown (Unhappy Path)
*   **Scenario:** Attempt modifications on historical entries.
*   **Assertions:** Events residing in historical (grayed-out) cells are strictly locked down. Drag-and-drop operations must be blocked, and contextual action menus (like *Reschedule* or *Edit*) must be disabled or entirely suppressed in the DOM.

