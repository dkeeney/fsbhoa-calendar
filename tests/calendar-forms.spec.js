// tests/calendar-forms.spec.js
// NOTE: Dates are dynamic. This means that every time we run the test we might get different results.
//       To minimize that effict, lets initalize a repeating event on the current month
//       and then advance to the next month to manipulate the dates for a test.
//       So, the tests should not hard code any date or assume any day of the calendar
//       falls on any specific day of the week.
//
// tests/calendar-forms.spec.js
const { test, expect } = require('@playwright/test');

const APP_URL = 'https://testbed.fsbhoa.com';

test.describe('Calendar Forms and Modals', () => {

  // --- DYNAMIC TIME & LOCATOR CALCULATION ---
  const today = new Date();

  // 1. Current Month (For seeding the Master origin)
  const currentYyyy = today.getFullYear();
  const currentMm = String(today.getMonth() + 1).padStart(2, '0');
  const SERIES_START_DATE = `${currentYyyy}-${currentMm}-01`;

  // 2. Next Month (Safe future space for UI interaction)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextYyyy = nextMonth.getFullYear();
  const nextMm = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const NEXT_MONTH_URL_PARAM = `${nextYyyy}-${nextMm}-01`;

  // 3. Find the First Monday of Next Month (For interacting with the Weekly Series)
  let firstMonday = new Date(nextMonth);
  while (firstMonday.getDay() !== 1) { // 1 = Monday
      firstMonday.setDate(firstMonday.getDate() + 1);
  }
  const targetMo = String(firstMonday.getMonth() + 1).padStart(2, '0');
  const targetDd = String(firstMonday.getDate()).padStart(2, '0');
  const RECURRING_EVENT_DATE = `${firstMonday.getFullYear()}-${targetMo}-${targetDd}`;

  // 4. Safe random days in Next Month for Add/Single interactions
  let emptyDay = new Date(firstMonday);
  emptyDay.setDate(emptyDay.getDate() + 8);
  const EMPTY_DAY_DATE = `${emptyDay.getFullYear()}-${String(emptyDay.getMonth() + 1).padStart(2, '0')}-${String(emptyDay.getDate()).padStart(2, '0')}`;

  // SINGLE_EVENT: Third Wednesday (+16 days from First Monday)
  let singleDay = new Date(firstMonday);
  singleDay.setDate(singleDay.getDate() + 16);
  const SINGLE_EVENT_DATE = `${singleDay.getFullYear()}-${String(singleDay.getMonth() + 1).padStart(2, '0')}-${String(singleDay.getDate()).padStart(2, '0')}`;

  // ------------------------------------------

  test.beforeEach(async ({ page, context }) => {

    // Setup a listener for console.log
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // Also catch any uncaught runtime exceptions that crash the script entirely
    page.on('pageerror', exception => {
      console.log(`[BROWSER CRASH] UNCAUGHT EXCEPTION: ${exception.message}`);
    });

    // Lock into Sandbox Test Mode via Cookie
    await context.addCookies([{
        name: 'hoa_test_mode',
        value: '1',
        domain: new URL(APP_URL).hostname,
        path: '/'
    }]);


    // NAVIGATE FIRST to load WordPress and grab the security Nonce!
    await page.goto('/calendar');
    await page.waitForFunction(() => typeof window.hoa_config !== 'undefined');

    // =====================================================================
    // PRE-EMPTIVE CLEANUP
    // Wipe the sandbox tables and JSON file before injecting the new fixture
    // =====================================================================
    await page.evaluate(async () => {
        await fetch('/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=cleanup', {
            method: 'POST',
            headers: { 'X-WP-Nonce': window.hoa_config.nonce }
        });
    });

    // To confirm that the display format is decoupled from execution time.
    //await setSandboxOption(page, 'hoa_time_format', '24hr');


    // Define DB state payload
    const fixtureData = {
        events: [
            {
                _ref: "master_1",
                title: "Simple Series",
                start_date: SERIES_START_DATE, 
                start_time: "09:00:00",
                end_time: "10:00:00",
                rrule: "FREQ=WEEKLY;BYDAY=MO", 
                status: "active"
            },
            {
                _ref: "master_2",
                title: "Single Event",
                start_date: SINGLE_EVENT_DATE, 
                start_time: "12:00:00",
                end_time: "13:00:00",
                status: "active"
            }
        ]
    };

    // 1. Inject Fixture and return the newly generated DB IDs
    const mappedIds = await page.evaluate(async (data) => {
        const response = await fetch('/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=load_fixture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': window.hoa_config.nonce
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.success) throw new Error('Fixture failed: ' + JSON.stringify(result));
        return result.data.ids;
    }, fixtureData);

    // 3. Reload UI pointing directly to the next month target horizon
    await page.goto(`/calendar/?viewDate=${NEXT_MONTH_URL_PARAM}&pw_nocache=${Date.now()}`);

    //============================================
    // REGRESSION GROUND TRUTH TRACE: Print out the raw layout script tags to see if the server sent http or https!
    //const rawHtml = await page.content();
    //const scriptTags = rawHtml.match(/<script[^>]*src="[^"]*"[^>]*>/g) || [];
    //console.log("\n========================================================");
    //console.log("[SERVER HTML DUMP] Script tags sent by the backend:");
    //console.log("========================================================");
    //scriptTags.slice(0, 10).forEach(tag => console.log(tag));
    //console.log("========================================================\n");
    //============================================

    // The definitive milestone marker we want to hit once paths are fixed
    const appWrapper = page.locator('#hoa-calendar-app[data-render-complete="true"]');
    await expect(appWrapper).toBeAttached({ timeout: 15000 });
  });






  test('TEST 1: Grid Rendering Engine, Database Isolation, and Data Integrity', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 1 -- Test Framework");
    console.log("========================================================");

    // --- STEP A: VERIFY DATABASE FIXTURE STATE ---
    // We execute a runtime check against your get_db_state AJAX hook to ensure isolation works
    const dbState = await page.evaluate(async () => {
      // Find the hidden master ID on the page from the loaded dataset
      const masterEvent = window.allEvents.find(e => e.title === "Simple Series");
      if (!masterEvent) return { error: "Simple Series missing from window.allEvents memory" };

      const response = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${masterEvent.id}`, {
        headers: { 'X-WP-Nonce': window.hoa_config.nonce }

      });
      const result = await response.json();
      return result.success ? result.data.db_state : { error: result.data };
    });

    //console.log("[DB TRACE] Active Sandbox Database Record Family State:");
    //console.log(JSON.stringify(dbState, null, 2));

    // Assert that the sandbox environment table contains our master entry safely
    expect(dbState.error).toBeUndefined();
    expect(dbState.master).not.toBeNull();
    expect(dbState.master.title).toBe('Simple Series');

    // --- STEP B: VERIFY COMPILED JSON DATA IN FRONTEND MEMORY ---
    const frontendEvents = await page.evaluate(() => window.allEvents);
    console.log(`[JSON TRACE] Total compiled instances found inside frontend array: ${frontendEvents.length}`);

    const targetPrefix = `${nextYyyy}-${nextMm}`;
    const targetingNextMonth = frontendEvents.filter(e => e.date.startsWith(targetPrefix)); 
    console.log(`[JSON TRACE] Compiled target instances inside Next Month range window: ${targetingNextMonth.length}`);

    // --- STEP C: CONFIRM TIMELINE MONTH HORIZON NAVIGATION ---
    const appEl = page.locator('#hoa-calendar-app');

    // 1. Check our newly injected structural data indicators
    await expect(appEl).toHaveAttribute('data-view-year', String(nextYyyy));
    await expect(appEl).toHaveAttribute('data-view-month', String(parseInt(nextMm)));

    // 2. Validate background asset allocation rules to confirm the correct months layout is painted
    await expect(appEl).toHaveCSS('background-image', new RegExp(`cal-${nextYyyy}-${nextMm}\\.png`));
    console.log(`[UI TRACE] Confirmed view layer is locked onto: Year ${nextYyyy}, Month ${nextMm}`);

    // --- STEP D: DETECT RENDERED INSTANCE DAY MATRIX CELLS ---
    // Verify that the calendar container structure successfully mounted standard days
    const totalDayCells = await page.locator('#calendar-grid .calendar-day').count();
    console.log(`[GRID TRACE] Total rendered cell layout containers on screen: ${totalDayCells}`);

    // Your split cell grid mechanics enforce a strict 35 container limit layer count
    expect(totalDayCells).toBe(35);

    // Verify the explicit targeted day cell can be identified safely inside the DOM trees
    const targetCell = page.locator(`.calendar-day[data-date="${RECURRING_EVENT_DATE}"]`);
    await expect(targetCell).toBeAttached();

    console.log(`[SUCCESS] Day cell container [${RECURRING_EVENT_DATE}] successfully validated inside the grid workspace.`);
  });

  // =========================================================================
  // TEST 2 To confirm that days are rendered.
  // =========================================================================
  // =========================================================================
  // TEST 2.0: Standard Day Hover and Add-Event Plus Verification
  // =========================================================================
  test('TEST 2.0 Standard Day, can access Add.', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.0 -- Standard Day");
    console.log("========================================================");
    const target = RECURRING_EVENT_DATE;
    await page.goto('/calendar/');
    console.log(`[MATRIX LOG] Test 2.0, normal Condition: ${target}`);

    // Leap directly to the target date.
    await page.goto(`/calendar/?viewDate=${target}`);

    // locate the day cell
    const standardCell = page.locator(`.calendar-day[data-date="${target}"]`).first();

    // VERIFY DAY NUMBER: Extract the expected day number digits (e.g., "15" from "2026-06-15")
    const expectedDayNum = String(parseInt(target.split('-')[2], 10));
    const dayNumberEl = standardCell.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    // Confirm that the day cell has a plus icon when hovered.
    await standardCell.hover();
    const addIcon = standardCell.locator('.add-event-plus').first();
    await expect(addIcon).toBeVisible();
    await addIcon.evaluate(el => el.click());

    // Verify the edit modal launched and initialized clean
    const modal = page.locator('#hoa-edit-modal');
    await expect(modal).toBeVisible();
    //console.log(await modal.innerHTML());   // SEE WHAT WAS RENDERED
    const startDateInput = modal.locator('input[name="date"]');
    await startDateInput.waitFor({ state: 'attached', timeout: 5000 });
    await expect(startDateInput).toHaveValue(target);
    
    await page.locator('#hoa-edit-modal .close-modal, button:has-text("Cancel")').first().click();
  });

  // =========================================================================
  // TEST 2.1; Split day: Friday-Start, 31-Day Grid Execution Matrix
  // =========================================================================
  test('TEST 2.1; Grid Split day cell: (Friday 31-Day Split)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.1 -- Friday 31-Day Split");
    console.log("========================================================");
    await page.goto('/calendar/');
    let targets;
    try {
        targets = await calculateValidSplitHorizon(page, 1);
    } catch (e) {
        console.log("SKIPPED, No Friday-Start, 31-day months. " + e.message);
        test.skip(true, 'No Friday-Start, 31-day condition in month range; Skipping.');
        return;
    }
    console.log(`Testing Condition 1 (Friday 31 days Split) : ${targets.viewMonthRoot}`);

    // Leap directly to the month containing the target calculated date
    await page.goto(`/calendar/?viewDate=${targets.viewMonthRoot}&pw_nocache=${Date.now()}`);

    // A. Validate Upper Day Target (Day 24 Shard)
    const parentCell = page.locator(`.calendar-day[data-date="${targets.topDay}"]`).first();
    const topHalf = parentCell.locator('.split-half-top').first();
    // VERIFY DAY NUMBER: Extract the expected day number digits (e.g., "15" from "2026-06-15")
    let expectedDayNum = String(parseInt(targets.topDay.split('-')[2], 10));
    let dayNumberEl = topHalf.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    //  Tell Playwright to hover exactly in the Top-Left corner of the cell
    await topHalf.hover({ position: { x: 10, y: 10 }, force: true });
    const addIcon = topHalf.locator('.add-event-plus').first();
    await expect(addIcon).toHaveCSS('visibility', 'visible');
    await addIcon.evaluate(el => el.click());
    await expect(page.locator('#hoa-edit-modal')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targets.topDay);
    await page.locator('#hoa-edit-modal .close-modal, button:has-text("Cancel")').first().click();

    // B. Validate Lower Day Target (Day 31 Shard)
    //const bottomShard = page.locator(`.hoa-ghost-shard.shard-bottom[data-cell-date="${targets.bottomDay}"]`).first();
    const bottomHalf = parentCell.locator('.split-half-bottom').first();
    // VERIFY DAY NUMBER: Extract the expected day number digits (e.g., "15" from "2026-06-15")
    expectedDayNum = String(parseInt(targets.bottomDay.split('-')[2], 10));
    dayNumberEl = bottomHalf.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    const box = await bottomHalf.boundingBox();
    //  Tell Playwright to hover exactly in the Bottom-Right corner
    await bottomHalf.hover({ position: { x: box.width - 10, y: box.height - 10 }, force: true });
    await bottomHalf.locator('.day-number').first().hover({ force: true });
    const addIconBottom = bottomHalf.locator('.add-event-plus').first();
    await expect(addIconBottom).toHaveCSS('visibility', 'visible');
    await addIconBottom.evaluate(el => el.click());
    await expect(page.locator('#hoa-edit-modal')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targets.bottomDay);
  });

  // =========================================================================
  // Test 2.2: Saturday-Start, 30-Day Grid Execution Matrix
  // =========================================================================
  test('TEST 2.2; Grid Split day  cell: (Saturday 30-Day Split)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.2 -- Saturday 30-Day Split");
    console.log("========================================================");
    await page.goto('/calendar/');
    let targets;
    try {
        targets = await calculateValidSplitHorizon(page, 2);
    } catch (e) {
        console.log("SKIPPED, No Saturday-start, 30 day months. " + e.message);
        test.skip(true, 'No Saturday-Start, 30-day condition in month range; Skipping.');
        return;
    }
    console.log(`[MATRIX LOG] Testing Condition 2 on Month Horizon: ${targets.viewMonthRoot}`);

    await page.goto(`/calendar/?viewDate=${targets.viewMonthRoot}&pw_nocache=${Date.now()}`);

    // A. Validate Upper Day Target (Day 23)
    const parentCell = page.locator(`.calendar-day[data-date="${targets.topDay}"]`).first();
    const topHalf = parentCell.locator('.split-half-top').first();

    // VERIFY DAY NUMBER:
    let expectedDayNum = String(parseInt(targets.topDay.split('-')[2], 10));
    let dayNumberEl = topHalf.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    // Hover top-left corner & Click
    await topHalf.hover({ position: { x: 10, y: 10 }, force: true });
    const addIcon = topHalf.locator('.add-event-plus').first();
    await expect(addIcon).toHaveCSS('visibility', 'visible');
    await addIcon.evaluate(el => el.click());

    await expect(page.locator('#hoa-edit-modal')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targets.topDay);
    await page.locator('#hoa-edit-modal .close-modal, button:has-text("Cancel")').first().click();

    // B. Validate Lower Day Target (Day 30)
    const bottomHalf = parentCell.locator('.split-half-bottom').first();

    // VERIFY DAY NUMBER:
    expectedDayNum = String(parseInt(targets.bottomDay.split('-')[2], 10));
    dayNumberEl = bottomHalf.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    // Hover bottom-right corner & Click
    const box = await bottomHalf.boundingBox();
    await bottomHalf.hover({ position: { x: box.width - 10, y: box.height - 10 }, force: true });

    const addIconBottom = bottomHalf.locator('.add-event-plus').first();
    await expect(addIconBottom).toHaveCSS('visibility', 'visible');
    await addIconBottom.evaluate(el => el.click());

    await expect(page.locator('#hoa-edit-modal')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targets.bottomDay);
  });

  // =========================================================================
  // TEST 2.3; Saturday-Start, 31-Day Grid Execution Matrix
  // =========================================================================
  test('TEST 2.3; Grid Split day: (Saturday 31-Day Split)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.3 Saturday 31-day Split");
    console.log("========================================================");
    await page.goto('/calendar/');
    let targets;
    try {
        targets = await calculateValidSplitHorizon(page, 3);
    } catch (e) {
        console.log("SKIPPED No Saturday-Start, 31-day months " + e.message);
        test.skip(true, 'No Saturday-Start, 31-day condition in month range; Skipping.');
        return;
    }
    console.log(`[MATRIX LOG] Testing Condition 3 on Month Horizon: ${targets.viewMonthRoot}`);

    await page.goto(`/calendar/?viewDate=${targets.viewMonthRoot}&pw_nocache=${Date.now()}`);

    // A. Validate Upper Day Target (Day 24)
    const parentCell = page.locator(`.calendar-day[data-date="${targets.topDay}"]`).first();
    const topHalf = parentCell.locator('.split-half-top').first();

    // VERIFY DAY NUMBER:
    let expectedDayNum = String(parseInt(targets.topDay.split('-')[2], 10));
    let dayNumberEl = topHalf.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    // Hover top-left corner & Click
    await topHalf.hover({ position: { x: 10, y: 10 }, force: true });
    const addIcon = topHalf.locator('.add-event-plus').first();
    await expect(addIcon).toHaveCSS('visibility', 'visible');
    await addIcon.evaluate(el => el.click());

    await expect(page.locator('#hoa-edit-modal')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targets.topDay);
    await page.locator('#hoa-edit-modal .close-modal, button:has-text("Cancel")').first().click();

    // B. Validate Lower Day Target (Day 31)
    const bottomHalf = parentCell.locator('.split-half-bottom').first();

    // VERIFY DAY NUMBER:
    expectedDayNum = String(parseInt(targets.bottomDay.split('-')[2], 10));
    dayNumberEl = bottomHalf.locator('.day-number').first();
    await expect(dayNumberEl).toHaveText(expectedDayNum);

    // Hover bottom-right corner & Click
    const box = await bottomHalf.boundingBox();
    await bottomHalf.hover({ position: { x: box.width - 10, y: box.height - 10 }, force: true });

    const addIconBottom = bottomHalf.locator('.add-event-plus').first();
    await expect(addIconBottom).toHaveCSS('visibility', 'visible');
    await addIconBottom.evaluate(el => el.click());

    await expect(page.locator('#hoa-edit-modal')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveValue(targets.bottomDay);
  });

  // =========================================================================
  // TEST 2.4; Monday-Start, 31-Day Grid (Saturday 1st) - DOUBLE SPLIT
  // =========================================================================
  test('TEST 2.4; Grid Split day: Monday Start (Double Top Split)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.4 -- Monday Start: Saturday 31-Day (Double Split)");
    console.log("========================================================");
    await setSandboxOption(page, 'hoa_start_day', '1');  // First Day of week: MONDAY
    await page.goto('/calendar/');

    let targets;
    try {
        targets = await calculateValidSplitHorizon(page, 1, 1); // Condition 1, Monday Start (1)
    } catch (e) {
        console.log("SKIPPED. " + e.message);
        test.skip(true, 'No matching month condition in range.'); return;
    }

    await page.goto(`/calendar/?viewDate=${targets.viewMonthRoot}&pw_nocache=${Date.now()}`);
    // Inject Monday setting and Re-render!
    await page.evaluate(() => {
        window.hoa_config.start_day = '1';
        document.getElementById('hoa-calendar-app').removeAttribute('data-render-complete');
        window.render();
    });
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // A. Validate First Split (1 / 8) - Top Half
    const parentCell1 = page.locator(`.calendar-day[data-date="${targets.topDay}"]`).first();
    const topHalf1 = parentCell1.locator('.split-half-top').first();
    await expect(topHalf1.locator('.day-number').first()).toHaveText(String(parseInt(targets.topDay.split('-')[2], 10)));

    await topHalf1.hover({ position: { x: 10, y: 10 }, force: true });
    await expect(topHalf1.locator('.add-event-plus').first()).toHaveCSS('visibility', 'visible');

    // B. Validate Second Split (2 / 9) - Bottom Half
    const parentCell2 = page.locator(`.calendar-day[data-date="${targets.topDay2}"]`).first();
    const bottomHalf2 = parentCell2.locator('.split-half-bottom').first();
    await expect(bottomHalf2.locator('.day-number').first()).toHaveText(String(parseInt(targets.bottomDay2.split('-')[2], 10)));

    const box = await bottomHalf2.boundingBox();
    await bottomHalf2.hover({ position: { x: box.width - 10, y: box.height - 10 }, force: true });
    await expect(bottomHalf2.locator('.add-event-plus').first()).toHaveCSS('visibility', 'visible');
  });

  // =========================================================================
  // TEST 2.5; Monday-Start, 30-Day Grid (Sunday 1st)
  // =========================================================================
  test('TEST 2.5; Grid Split day: Monday Start (Sunday 30-Day Split)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.5 -- Monday Start: Sunday 30-Day Split");
    console.log("========================================================");
    await setSandboxOption(page, 'hoa_start_day', '1');  // First Day of week: MONDAY
    await page.goto('/calendar/');
    let targets;
    try {
        targets = await calculateValidSplitHorizon(page, 2, 1);
    } catch (e) { test.skip(true, 'No matching month condition in range.'); return; }

    await page.goto(`/calendar/?viewDate=${targets.viewMonthRoot}&pw_nocache=${Date.now()}`);
    await page.evaluate(() => { window.hoa_config.start_day = '1'; document.getElementById('hoa-calendar-app').removeAttribute('data-render-complete'); window.render(); });
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const parentCell = page.locator(`.calendar-day[data-date="${targets.topDay}"]`).first();
    const bottomHalf = parentCell.locator('.split-half-bottom').first();
    await expect(bottomHalf.locator('.day-number').first()).toHaveText(String(parseInt(targets.bottomDay.split('-')[2], 10)));
  });

  // =========================================================================
  // TEST 2.6; Monday-Start, 31-Day Grid (Sunday 1st)
  // =========================================================================
  test('TEST 2.6; Grid Split day: Monday Start (Sunday 31-Day Split)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 2.6 -- Monday Start: Sunday 31-Day Split");
    console.log("========================================================");
    await setSandboxOption(page, 'hoa_start_day', '1');  // First Day of week: MONDAY
    await page.goto('/calendar/');
    let targets;
    try {
        targets = await calculateValidSplitHorizon(page, 3, 1);
    } catch (e) { test.skip(true, 'No matching month condition in range.'); return; }

    await page.goto(`/calendar/?viewDate=${targets.viewMonthRoot}&pw_nocache=${Date.now()}`);
    await page.evaluate(() => { window.hoa_config.start_day = '1'; document.getElementById('hoa-calendar-app').removeAttribute('data-render-complete'); window.render(); });
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const parentCell = page.locator(`.calendar-day[data-date="${targets.topDay}"]`).first();
    const topHalf = parentCell.locator('.split-half-top').first();
    await expect(topHalf.locator('.day-number').first()).toHaveText(String(parseInt(targets.topDay.split('-')[2], 10)));
  });


  // =========================================================================
  // TEST 3: Day Modal Navigation & Split Cell Boundary Logic
  // =========================================================================
  test('TEST 3: Day Modal Navigation & Split Cell Boundary Logic', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 3 -- Boundary");
    console.log("========================================================");

    // --- SCENARIO A: Standard Month Boundaries ---
    const stdMonth = await findNonSplitMonth();
    console.log(`[MATRIX] Standard Month Found: ${stdMonth.viewMonthRoot}`);
    await page.goto(`/calendar/?viewDate=${stdMonth.viewMonthRoot}`);

    await createTestEvent(page, stdMonth.firstDay, 'Boundary Event First');
    await verifyDayModal(page, stdMonth.firstDay, 'Boundary Event First');

    await createTestEvent(page, stdMonth.midDay, 'Boundary Event Mid');
    await verifyDayModal(page, stdMonth.midDay, 'Boundary Event Mid');

    await createTestEvent(page, stdMonth.lastDay, 'Boundary Event Last');
    await verifyDayModal(page, stdMonth.lastDay, 'Boundary Event Last');

    // --- SCENARIO B: Split Month Boundaries ---
    const splitMonth = await calculateValidSplitHorizon(page, 1);
    console.log(`[MATRIX] Split Month Found: ${splitMonth.viewMonthRoot}`);
    await page.goto(`/calendar/?viewDate=${splitMonth.viewMonthRoot}`);

    await createTestEvent(page, splitMonth.topDay, 'Split Top Event');
    await verifyDayModal(page, splitMonth.topDay, 'Split Top Event');

    await createTestEvent(page, splitMonth.bottomDay, 'Split Bottom Event');
    await verifyDayModal(page, splitMonth.bottomDay, 'Split Bottom Event');
  });

  // =========================================================================
  // TEST 4: Detail Modal & Flyer Routing
  // =========================================================================
  test('TEST 4: Detail Modal & Flyer Routing', async ({ page, context }) => {
    console.log("\n========================================================");
    console.log("TEST 4 -- Detail Modal");
    console.log("========================================================");

    const stdMonth = await findNonSplitMonth();
    await page.goto(`/calendar/?viewDate=${stdMonth.viewMonthRoot}`);

    // --- SCENARIO A: Modal Fallback (Title Click) ---
    // Create an event to click on
    await createTestEvent(page, stdMonth.midDay, 'Detail Modal Target');

    const standardCell = page.locator(`.calendar-day[data-date="${stdMonth.midDay}"]`).first();
    const textTitle = standardCell.locator('.event-item').filter({ hasText: 'Detail Modal Target' }).first();

    // Click the text title
    await textTitle.evaluate(el => el.click());

    // FIX: Use Playwright's :visible pseudo-class to automatically grab the active mode's modal
    const activeDetailModal = page.locator('.hoa-detail-modal:visible');
    await expect(activeDetailModal).toBeVisible();

    // Close it
    await activeDetailModal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());

    // We check the base class here to ensure ALL detail modals are hidden
    await expect(page.locator('.hoa-detail-modal:visible')).toHaveCount(0);


    // --- SCENARIO B & C: Flyer Bypass (New Tab Routing) ---

    // Navigate to the correct month horizon where EMPTY_DAY_DATE actually lives
    await page.goto(`/calendar/?viewDate=${NEXT_MONTH_URL_PARAM}&pw_nocache=${Date.now()}`);

    // 1. Create a new event with a mock Flyer URL using our empty day
    const flyerDate = EMPTY_DAY_DATE;
    const flyerCell = page.locator(`.calendar-day[data-date="${flyerDate}"]`).first();

    await flyerCell.hover({ force: true });
    await flyerCell.locator('.add-event-plus').first().evaluate(el => el.click());

    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();

    // NOW we can verify the WP Media frame, because the modal is actually open
    const browseLink = editModal.locator('#upload-flyer-link');
    await browseLink.evaluate(el => el.click());

    // Check if the WP native media modal attaches to the DOM
    const wpMediaModal = page.locator('.media-modal.wp-core-ui');
    await expect(wpMediaModal).toBeVisible();

    // Close the WP modal safely
    await page.locator('.media-modal-close').first().evaluate(el => el.click());
    await expect(page.locator('.hoa-detail-modal:visible')).toHaveCount(0);

    // Resume filling out the event form...
    await editModal.locator('input[name="title"]').fill('Flyer Bypass Event');

    // Inject the real static asset URL
    // If we can display a png we should be able to display an html or pdf as well.
    const testFlyerUrl = `${APP_URL}/wp-content/plugins/hoaplugin-calendar/tests/assets/dummy-image.png`;
    await editModal.locator('#flyer_url_input').fill(testFlyerUrl);

    await editModal.locator('.hoa-save-btn').click();
    await expect(editModal).toBeHidden({ timeout: 5000 });

    const appWrapper = page.locator('#hoa-calendar-app[data-render-complete="true"]');
    await expect(appWrapper).toBeVisible({ timeout: 10000 });

    // 2. Test the bypass logic
    await flyerCell.hover({ force: true });
    const flyerEventChip = flyerCell.locator('.event-item').filter({ hasText: 'Flyer Bypass Event' }).first();

    // 3. Catch the New Tab
    const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        flyerEventChip.evaluate(el => el.click())
    ]);

    // Verify the new tab successfully routed to our actual test file
    await expect(newPage).toHaveURL(testFlyerUrl);

    // Clean up
    await newPage.close();

    // Verify the detail modal never spawned in the background
    await expect(page.locator('.hoa-detail-modal:visible')).toHaveCount(0);
  });




  test('TEST 5: Edit pencils appear and open the "Edit Event" modal', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 5 -- Edit Modal");
    console.log("========================================================");
    await page.goto(`/calendar/?viewDate=${RECURRING_EVENT_DATE}`);
    // 1. Target the normal calendar day (no ghost shards here!)
    const parentCell = page.locator(`.calendar-day[data-date="${RECURRING_EVENT_DATE}"]`).first();
    const eventItem = parentCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    // Hover to reveal the pencil
    await eventItem.hover({ force: true });

    // 3. Find the pencil inside this specific event
    const editPencil = eventItem.locator('.edit-pencil, .edit-pencil-mini').first();

    // 4. Bypass Playwright's strict geometry check and click it directly
    await editPencil.evaluate(el => el.click());

    // 5. Verify the edit modal opened successfully
    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();

    // Verify it opened in edit mode by checking for the hidden input
    await expect(page.locator('input[name="event_id"]')).not.toBeEmpty();

    // Verify the date passed to the modal matches the cell's expected date!
    await expect(editModal.locator('input[name="date"]')).toHaveValue(RECURRING_EVENT_DATE);

    // Close the modal
    await page.locator('#hoa-edit-modal .close-modal, button:has-text("Cancel")').first().click();
  });



  test('TEST 6: Edit Modal RRule builder works bi-directionally', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 6 -- RRule");
    console.log("========================================================");
    const testDate = `${nextYyyy}-${nextMm}-10`; // Day 10 is a safe, normal day
    const dayCell = page.locator(`.calendar-day[data-date="${testDate}"]`).first();
    
    await dayCell.hover({ force: true });

    // FIX: Standard day, so we click the plus inside the normal cell directly
    await dayCell.locator('.add-event-plus').first().evaluate(el => el.click());

    const modal = page.locator('#hoa-edit-modal');
    await expect(modal).toBeVisible();

    // Part 1: Test building a new RRule from the UI
    await modal.locator('input[name="title"]').fill('Test RRule Event');
    await modal.locator('#is_repeating').check();
    await expect(modal.locator('#rr-builder-panel')).toBeVisible();

    await modal.locator('.rr-day[value="MO"]').check();
    await modal.locator('.rr-day[value="WE"]').check();
    await expect(modal.locator('#rrule_input')).toHaveValue('FREQ=WEEKLY;BYDAY=MO,WE');

    await modal.locator('.rr-week[value="1"]').check();
    await expect(modal.locator('#rrule_input')).toHaveValue('FREQ=MONTHLY;BYDAY=MO,WE;BYSETPOS=1');

    await modal.locator('#is_repeating').uncheck();
    await expect(modal.locator('#rr-builder-panel')).not.toBeVisible();
    await expect(modal.locator('#rrule_input')).toHaveValue('');

    // FIX: Use correct close button classes and bypass click
    await modal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());
    await expect(modal).not.toBeVisible();

    // Part 2: Test reverse-engineering an existing RRule
    const existingEventCell = page.locator(`.calendar-day[data-date="${RECURRING_EVENT_DATE}"]`).first();
    await existingEventCell.hover({ force: true });

    // Target the pencil inside the actual event chip, and bypass native click
    const existingEventChip = existingEventCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await existingEventChip.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    
    await expect(modal).toBeVisible();

    await expect(modal.locator('#rrule_input')).toHaveValue('FREQ=WEEKLY;BYDAY=MO');
    await expect(modal.locator('.rr-day[value="MO"]')).toBeChecked();
    await expect(modal.locator('.rr-day[value="TU"]')).not.toBeChecked();

    // Handle standard execution confirm box trigger conditions safely
    page.once('dialog', dialog => dialog.accept());
    await modal.locator('#is_repeating').uncheck();
    await expect(modal.locator('#rrule_input')).toHaveValue('');
    
    // Cleanup to prevent bleeding into next tests
    await modal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());
  });



  test('TEST 7: "Cancel Event" on a single event shows correct options', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 7 -- Cancel Single");
    console.log("========================================================");
    const dayCell = page.locator(`.calendar-day[data-date="${SINGLE_EVENT_DATE}"]`).first();
    await dayCell.hover({ force: true });

    // FIX: Target the standard day event chip directly
    const activeEvent = dayCell.locator('.event-item').filter({ hasText: 'Single Event' }).first();
    await activeEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());

    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();
    await editModal.locator('button:has-text("Cancel Event")').click();

    const manageModal = page.locator('#hoa-manage-modal');
    await expect(manageModal).toBeVisible();
    await expect(manageModal.locator('button:has-text("Delete Event Forever")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("Cancel ONLY this instance")')).not.toBeVisible();

    // Cleanup
    await manageModal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());
  });




  test('TEST 8: "Cancel Event" on a recurring event shows correct options', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 8 -- Cancel Recurring");
    console.log("========================================================");
    const dayCell = page.locator(`.calendar-day[data-date="${RECURRING_EVENT_DATE}"]`).first();
    await dayCell.hover({ force: true });

    // FIX: Target the standard day event chip directly
    const activeEvent = dayCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await activeEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());

    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();
    await editModal.locator('button:has-text("Cancel Event")').click();

    const manageModal = page.locator('#hoa-manage-modal');
    await expect(manageModal).toBeVisible();

    await expect(manageModal.locator('button:has-text("Cancel ONLY this instance")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("Restore or Undelete Next Cancelled Instance")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("End series starting today")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("DELETE ENTIRE SERIES & HISTORY")')).toBeVisible();

    // Cleanup
    await manageModal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());
  });




  test('TEST 9: "Reschedule" button opens the reschedule modal with correct options', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 9  -- Reschedule");
    console.log("========================================================");
    // Part 1: Test with a recurring event
    const recurringCell = page.locator(`.calendar-day[data-date="${RECURRING_EVENT_DATE}"]`).first();
    await recurringCell.hover({ force: true });

    const recurringEvent = recurringCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await recurringEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());

    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();

    await editModal.locator('button:has-text("Reschedule")').click();

    const rescheduleModal = page.locator('#hoa-reschedule-modal');
    await expect(rescheduleModal).toBeVisible();
    await expect(rescheduleModal.locator('#scope_instance')).toBeAttached();
    await expect(rescheduleModal.locator('#scope_remaining')).toBeAttached();

    // Close the reschedule modal
    await rescheduleModal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());
    await expect(rescheduleModal).not.toBeVisible();

    // Part 2: Test with a single event
    await page.goto(`${APP_URL}/calendar?viewDate=${NEXT_MONTH_URL_PARAM}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#calendar-grid .calendar-day');

    const singleCell = page.locator(`.calendar-day[data-date="${SINGLE_EVENT_DATE}"]`).first();
    await singleCell.hover({ force: true });

    const singleEvent = singleCell.locator('.event-item').filter({ hasText: 'Single Event' }).first();
    await singleEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());

    await expect(editModal).toBeVisible();
    await editModal.locator('button:has-text("Reschedule")').click();

    await expect(rescheduleModal).toBeVisible();
    await expect(rescheduleModal.locator('p', { hasText: '* This move only affects this specific event.' })).toBeVisible();

    await expect(rescheduleModal.locator('#scope_instance')).not.toBeVisible();

    // Cleanup
    await rescheduleModal.locator('.close-modal, .modal-close').first().evaluate(el => el.click());
  });


  test('TEST 10: Drag-and-Drop (The Boomerang Test)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 10 (Boomerang & DB Cleanup)");
    console.log("========================================================");

    await page.goto(`/calendar/?viewDate=${NEXT_MONTH_URL_PARAM}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const masterId = await page.evaluate(() => {
      const ev = window.allEvents.find(e => e.title === "Simple Series");
      return ev.id.toString().split('_')[0];
    });

    const sourceCell = page.locator(`.calendar-day[data-date="${RECURRING_EVENT_DATE}"]`).first();
    const chip = sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await expect(chip).toBeVisible();

    // ========================================================
    // THE DIAGNOSTIC INTERROGATION
    // ========================================================
    const domStartTime = await chip.getAttribute('data-event-start-time');
    console.log(`[DIAGNOSTIC] DOM Attribute 'data-event-start-time' reads: "${domStartTime}"`);

    const memoryEvent = await page.evaluate((tgtDate) => {
        return window.allEvents.find(e => e.title === "Simple Series" && e.date === tgtDate);
    }, RECURRING_EVENT_DATE);

    if (memoryEvent) {
        console.log(`[DIAGNOSTIC] JSON Memory Event 'start_time' reads: "${memoryEvent.start_time}"`);
        console.log(`[DIAGNOSTIC] JSON Memory Event 'start_fmt' reads: "${memoryEvent.start_fmt}"`);
    } else {
        console.log(`[DIAGNOSTIC] CRITICAL: Event not found in window.allEvents for date ${RECURRING_EVENT_DATE}`);
    }
    // ========================================================

    const targetCell = page.locator(`.calendar-day[data-date="${EMPTY_DAY_DATE}"]`).first();

    // 1. Execute First Move
    await forceDrag(chip, targetCell, false);

    const movedChip = targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await expect(movedChip).toBeVisible({ timeout: 10000 });
    await expect(sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' })).toHaveCount(0);

    // 2. Fetch DB State
    let dbState = await page.evaluate(async (mId) => {
      const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}&cb=${Date.now()}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
      return (await res.json()).data.db_state;
    }, masterId);

    expect(dbState.children.length).toBe(2);

    const holeRecord = dbState.children.find(c => c.status === 'cancelled' || c.status === 'hole');
    const moveRecord = dbState.children.find(c => c.status === 'active' || c.status === 'move');

    expect(holeRecord).toBeDefined();
    expect(moveRecord).toBeDefined();
    console.log(`[DB TRACE] Move successful. Found 1 Hole (${holeRecord.start_datetime}) and 1 Move (${moveRecord.start_datetime}).`);

    // 3. The Boomerang
    await forceDrag(movedChip, sourceCell, false);

    await expect(sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first()).toBeVisible({ timeout: 10000 });
    await expect(targetCell.locator('.event-item').filter({ hasText: 'Simple Series' })).toHaveCount(0);

    // 4. Fetch DB State
    dbState = await page.evaluate(async (mId) => {
      const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}&cb=${Date.now()}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
      return (await res.json()).data.db_state;
    }, masterId);

    expect(dbState.children.length).toBe(0);
    console.log(`[DB TRACE] Boomerang successful. Master restored. Child exceptions: ${dbState.children.length}`);
  });





  test('TEST 11A: Shift-Pivot on 1st Instance (In-Place Update)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 11A (Shift Pivot on 1st Instance)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });
    const firstMondayDate = await getNthInstanceDate(page, targetEventId, 0);

    const [y, m] = firstMondayDate.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // Calculate 1st Tuesday (Target)
    const firstTuesdayObj = new Date(firstMondayDate + 'T12:00:00');
    firstTuesdayObj.setDate(firstTuesdayObj.getDate() + 1);
    const firstTuesdayDate = `${firstTuesdayObj.getFullYear()}-${String(firstTuesdayObj.getMonth() + 1).padStart(2, '0')}-${String(firstTuesdayObj.getDate()).padStart(2, '0')}`;
    console.log(`     Monday: ${firstMondayDate}, Tuesday: ${firstTuesdayDate}`);

    const sourceCell = page.locator(`.calendar-day[data-date="${firstMondayDate}"]`).first();
    const chip = sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    const targetCell = page.locator(`.calendar-day[data-date="${firstTuesdayDate}"]`).first();

    await forceDrag(chip, targetCell, true);

    await expect(targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first()).toBeVisible({ timeout: 10000 });
    await expect(sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' })).toHaveCount(0);

    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible();

    const dbState = await page.evaluate(async (mId) => {
      const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
      return (await res.json()).data.db_state;
    }, targetEventId);

    expect(dbState.children.length).toBe(0);
    expect(dbState.master.rrule).toContain('TU');
    console.log(`[DB TRACE] 1st Instance Pivot successful. Master updated in-place (0 children spawned).`);
  });


  test('TEST 11B: Shift-Pivot on 2nd Instance (Spawns Child Record)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 11B (Shift Pivot on 2nd Instance)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const firstMondayDate = await getNthInstanceDate(page, targetEventId, 0);
    const secondMondayDate = await getNthInstanceDate(page, targetEventId, 1);

    const [y, m] = secondMondayDate.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // Calculate 2nd Tuesday and 3rd Tuesday for rendering checks
    const secondTuesdayObj = new Date(secondMondayDate + 'T12:00:00');
    secondTuesdayObj.setDate(secondTuesdayObj.getDate() + 1);
    const secondTuesdayDate = `${secondTuesdayObj.getFullYear()}-${String(secondTuesdayObj.getMonth() + 1).padStart(2, '0')}-${String(secondTuesdayObj.getDate()).padStart(2, '0')}`;

    const thirdTuesdayObj = new Date(secondTuesdayDate + 'T12:00:00');
    thirdTuesdayObj.setDate(thirdTuesdayObj.getDate() + 7);
    const thirdTuesdayDate = `${thirdTuesdayObj.getFullYear()}-${String(thirdTuesdayObj.getMonth() + 1).padStart(2, '0')}-${String(thirdTuesdayObj.getDate()).padStart(2, '0')}`;

    const sourceCell = page.locator(`.calendar-day[data-date="${secondMondayDate}"]`).first();
    const chip = sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    const targetCell = page.locator(`.calendar-day[data-date="${secondTuesdayDate}"]`).first();

    await forceDrag(chip, targetCell, true);

    const firstMonCell = page.locator(`.calendar-day[data-date="${firstMondayDate}"]`).first();
    const thirdTueCell = page.locator(`.calendar-day[data-date="${thirdTuesdayDate}"]`).first();

    await expect(targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first()).toBeVisible({ timeout: 10000 });
    await expect(thirdTueCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first()).toBeVisible({ timeout: 10000 });

    // Check historical boundaries (if the first Monday was in this month horizon)
    if (firstMondayDate.startsWith(targetHorizon.substring(0, 7))) {
        await expect(firstMonCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first()).toBeVisible();
    }
    await expect(sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' })).toHaveCount(0);

    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible();

    const dbState = await page.evaluate(async (mId) => {
      const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
      return (await res.json()).data.db_state;
    }, targetEventId);

    const pivotRecord = dbState.children.find(c => c.start_datetime && c.start_datetime.startsWith(secondMondayDate));
    expect(pivotRecord).toBeDefined();
    expect(pivotRecord.rrule).toContain('TU');
    console.log(`[DB TRACE] 2nd Instance Pivot successful. Child record spawned!`);
  });


  test('TEST 12: Context Highlighting & Viewport Anchors', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 12 -- Today");
    console.log("========================================================");
    // 1. Navigate to CURRENT month to ensure 'today' exists in the grid
    await page.goto(`/calendar/?viewDate=${SERIES_START_DATE}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // Verify Today Highlight
    const todayCell = page.locator('.calendar-day.today').first();
    await expect(todayCell).toBeVisible();

    // 2. Navigate away to Next Month to test the jump button
    await page.goto(`/calendar/?viewDate=${NEXT_MONTH_URL_PARAM}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // 3. Test "Today" Toolbar Button
    // (Update the locator if your toolbar button uses a different class/ID!)
    await page.locator('.jump-today, #jumpToday, button:has-text("Today")').first().click();

    // Assert: Viewport redirected to today's month
    const app = page.locator('#hoa-calendar-app');
    const todayDate = new Date();
    await expect(app).toHaveAttribute('data-view-month', String(todayDate.getMonth() + 1));
  });

  test('TEST 13: Temporal State Lockdown', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 13  -- past days");
    console.log("========================================================");

    // 1. Extend the past limit guardrail so the UI allows navigating backward
    await setSandboxOption(page, 'hoa_past_limit', '2');
    await page.evaluate(() => {
        const today = new Date();
        // Recalculate the window threshold matching the new past_limit
        window.fsbMinTime = new Date(today.getFullYear(), today.getMonth() - 2, 1).getTime();
        // Refresh the navigation arrow states to unlock the button
        updateNavGuardrails(window.currentYear, window.currentMonth);
    });

    // 2. Click the previous month button to drop back into the current month horizon
    await page.locator('#prevMonth').first().click();
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // 3. Target the 1st of the current month (SERIES_START_DATE) which is a past-day
    const pastCell = page.locator(`.calendar-day[data-date="${SERIES_START_DATE}"]`).first();
    await expect(pastCell).toBeVisible();
    await expect(pastCell).toHaveClass(/past-day/);

    // 4. Hover over the past cell and trigger the Add Event Modal
    await pastCell.hover({ force: true });
    const addIcon = pastCell.locator('.add-event-plus').first();
    await expect(addIcon).toBeVisible();
    await addIcon.evaluate(el => el.click());

    // 5. Interact with the Edit Modal Form
    const modal = page.locator('#hoa-edit-modal');
    await expect(modal).toBeVisible();

    // Fill the title
    await modal.locator('input[name="title"]').fill('Past Repeating Series');

    // Toggle the repeating options layout panel
    await modal.locator('#is_repeating').check();
    await expect(modal.locator('#rr-builder-panel')).toBeVisible();

    // Set to repeat on Mondays (Since June 1, 2026 is a Monday)
    await modal.locator('.rr-day[value="MO"]').check();

    // 6. Save the new historical series
    await modal.locator('.hoa-save-btn').click();

    // Verify modal closes and grid rebuild pass completes successfully
    await expect(modal).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    // 7. Verify the generated event chip has edit permissions intact
    const eventChip = pastCell.locator('.event-item').filter({ hasText: 'Past Repeating Series' }).first();
    await eventChip.hover({ force: true });

    // Assert: Verify the edit pencil renders natively inside the past day card
    const editPencil = eventChip.locator('.edit-pencil, .edit-pencil-mini').first();
    await expect(editPencil).toBeVisible();
  });


  test('TEST 14: Empty title acts as a manual "Bake" trigger without adding an event', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 14 (Manual Bake)");
    console.log("========================================================");

    // Target a known empty day
    const dayCell = page.locator(`.calendar-day[data-date="${EMPTY_DAY_DATE}"]`).first();
    await dayCell.hover({ force: true });

    // Open the creation modal natively
    await dayCell.locator('.add-event-plus').first().evaluate(el => el.click());

    const modal = page.locator('#hoa-edit-modal');
    await expect(modal).toBeVisible();

    // Ensure the title is absolutely empty
    await modal.locator('input[name="title"]').fill('');

    // Trigger the save action (The Bake Command)
    await modal.locator('.hoa-save-btn').click();

    // 1. Verify the modal closes automatically after the backend responds
    await expect(modal).toBeHidden({ timeout: 5000 });

    // 2. Verify the frontend reload cycle completed (data-render-complete drops and returns)
    const appWrapper = page.locator('#hoa-calendar-app[data-render-complete="true"]');
    await expect(appWrapper).toBeVisible({ timeout: 10000 });

    // 3. Verify Database Integrity: The compiler should not have output a blank event
    await expect(dayCell.locator('.event-item')).toHaveCount(0);
  });

  test('TEST 15: The Void Drop', async ({ page }) => {
    console.log("\n========================================================");
    console.log(" TEST 15  -- drop outside grid");
    console.log("========================================================");
    const chip = page.locator('.event-item').first();

    // Drag to 0,0 (top left of the browser window, outside the grid)
    await page.mouse.move(50, 50);
    await page.mouse.down();
    await page.mouse.move(0, 0);
    await page.mouse.up();

    // Assert: Event chip returned to its original grid position
    await expect(chip).toBeVisible();
  });

  test('TEST 16A: Time Shift - First Instance (In-Place Update)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 16A (Time Shift on 1st Instance)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const firstMonday = await getNthInstanceDate(page, targetEventId, 0);

    const [y, m] = firstMonday.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const sourceCell = page.locator(`.calendar-day[data-date="${firstMonday}"]`).first();
    const chip = sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await expect(chip).toBeVisible();

    await chip.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();

    await editModal.locator('input[name="start_time"]').fill('10:00');
    await editModal.locator('input[name="end_time"]').fill('11:00');
    await editModal.locator('.hoa-save-btn').click();

    await expect(editModal).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    const dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);

    expect(dbState.children.length).toBe(0);
    expect(dbState.master.start_datetime).toContain('10:00:00');
    console.log(`[DB TRACE] 1st Instance Time Shift successful. Master updated in-place to 10:00:00.`);
  });


  test('TEST 16B: Time Shift - 2nd Instance (Spawns Pivot)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 16B (Time Shift on 2nd Instance)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const secondMonday = await getNthInstanceDate(page, targetEventId, 1);

    const [y, m] = secondMonday.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const sourceCell = page.locator(`.calendar-day[data-date="${secondMonday}"]`).first();
    const chip = sourceCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    await expect(chip).toBeVisible();

    await chip.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();

    await editModal.locator('input[name="start_time"]').fill('10:00');
    await editModal.locator('input[name="end_time"]').fill('11:00');
    await editModal.locator('.hoa-save-btn').click();

    await expect(editModal).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    const dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);

    expect(dbState.children.length).toBeGreaterThan(0);
    const pivot = dbState.children.find(c => c.start_datetime.startsWith(secondMonday));
    expect(pivot).toBeDefined();
    expect(pivot.start_datetime).toContain('10:00:00');
    console.log(`[DB TRACE] 2nd Instance Time Shift successful. Pivot spawned for ${secondMonday} at 10:00:00.`);
  });



  test('TEST 17: Execute "End Series" via Modal', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 17 (End Series via Modal & Backend Assert)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const firstMonday = await getNthInstanceDate(page, targetEventId, 0);
    const secondMonday = await getNthInstanceDate(page, targetEventId, 1);

    // We expect the third instance to be cut off
    let thirdMonday;
    try {
        thirdMonday = await getNthInstanceDate(page, targetEventId, 2);
    } catch(e) {
        thirdMonday = null; // Failsafe in case it's already bounded
    }

    const [y, m] = firstMonday.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const targetCell = page.locator(`.calendar-day[data-date="${secondMonday}"]`).first();
    const activeEvent = targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();

    await activeEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    await page.locator('#hoa-edit-modal button:has-text("Cancel Event")').click();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#hoa-manage-modal button:has-text("End series starting today")').click();

    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    await expect(page.locator(`.calendar-day[data-date="${firstMonday}"] .event-item`).filter({ hasText: 'Simple Series' })).toBeVisible();
    await expect(page.locator(`.calendar-day[data-date="${secondMonday}"] .event-item`).filter({ hasText: 'Simple Series' })).toBeVisible();

    if (thirdMonday && thirdMonday.startsWith(targetHorizon.substring(0, 7))) {
        await expect(page.locator(`.calendar-day[data-date="${thirdMonday}"] .event-item`).filter({ hasText: 'Simple Series' })).toHaveCount(0);
    }

    const dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);

    expect(dbState.master.rrule).toContain('UNTIL=');
    console.log(`[DB TRACE] End Series successful. RRule is now: ${dbState.master.rrule}`);
  });



  test('TEST 18: Execute "Cancel Instance" & "Restore Instance"', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 18 (Cancel Hole & Restore & Backend Assert)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const firstMonday = await getNthInstanceDate(page, targetEventId, 0);
    const secondMonday = await getNthInstanceDate(page, targetEventId, 1);

    const [y, m] = firstMonday.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // --- PART 1: CANCEL INSTANCE ---
    const targetCell = page.locator(`.calendar-day[data-date="${secondMonday}"]`).first();
    const activeEvent = targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();

    await activeEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    await page.locator('#hoa-edit-modal button:has-text("Cancel Event")').click();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#hoa-manage-modal button:has-text("Cancel ONLY this instance")').click();

    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });
    await expect(targetCell.locator('.event-item').filter({ hasText: 'Simple Series' })).toHaveCount(0);

    let dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);

    const holeRecord = dbState.children.find(c => c.status === 'cancelled' && c.start_datetime.startsWith(secondMonday));
    expect(holeRecord).toBeDefined();

    // --- PART 2: RESTORE INSTANCE ---
    const firstCell = page.locator(`.calendar-day[data-date="${firstMonday}"]`).first();
    const firstEvent = firstCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();

    await firstEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    await page.locator('#hoa-edit-modal button:has-text("Cancel Event")').click();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#hoa-manage-modal button:has-text("Restore or Undelete Next Cancelled Instance")').click();

    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });
    await expect(targetCell.locator('.event-item').filter({ hasText: 'Simple Series' })).toBeVisible();

    dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);

    const remainingHoles = dbState.children.filter(c => c.status === 'cancelled');
    expect(remainingHoles.length).toBe(0);
    console.log(`[DB TRACE] Restore successful. Hole records purged.`);
  });



  test('TEST 19: "In-Place" Pivot Override (Editing an active Pivot)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 19 (In-Place Pivot Override)");
    console.log("========================================================");

    await page.waitForFunction(() => window.allEvents && window.allEvents.length > 0);
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Simple Series");
        if (!ev) throw new Error("Simple Series not found in memory!");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const firstMonday = await getNthInstanceDate(page, targetEventId, 0);
    const secondMonday = await getNthInstanceDate(page, targetEventId, 1);

    const [y, m] = firstMonday.split('-');
    const targetHorizon = `${y}-${m}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // --- STEP 1: Spawn the Initial Pivot ---
    let targetCell = page.locator(`.calendar-day[data-date="${secondMonday}"]`).first();
    let activeEvent = targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    
    await activeEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    await page.locator('#hoa-edit-modal input[name="start_time"]').fill('10:00');
    await page.locator('#hoa-edit-modal .hoa-save-btn').click();
    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    let dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);
    expect(dbState.children.length).toBe(1);

    // --- STEP 2: Edit the Pivot In-Place ---
    targetCell = page.locator(`.calendar-day[data-date="${secondMonday}"]`).first();
    activeEvent = targetCell.locator('.event-item').filter({ hasText: 'Simple Series' }).first();
    
    await activeEvent.locator('.edit-pencil, .edit-pencil-mini').first().evaluate(el => el.click());
    await page.locator('#hoa-edit-modal input[name="start_time"]').fill('11:00');
    await page.locator('#hoa-edit-modal .hoa-save-btn').click();
    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    // --- STEP 3: Assert DB maintained exactly 1 child ---
    dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);
    
    expect(dbState.children.length).toBe(1);
    expect(dbState.children[0].start_datetime).toContain('11:00:00');
    console.log(`[DB TRACE] Pivot overridden in-place successfully. Expected 1 child, found 1.`);
  });



  // =========================================================================
  // TEST 20: 24-Hour Time Formatting
  // =========================================================================
  test('TEST 20: 24-Hour Time Formatting', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 20 -- 24 Hour Formatting");
    console.log("========================================================");
    await page.goto('/calendar/');
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // 1. USE THE NEW HELPER: Set 24-hour mode
    await setSandboxOption(page, 'hoa_time_format', '24hr');

    // 2. Inject the dummy event and re-render
    await page.evaluate(() => {
        const year = window.currentYear;
        const month = String(window.currentMonth + 1).padStart(2, '0');
        const dynamicDate = `${year}-${month}-15`;

        window.allEvents.push({
            id: 9999, instance_id: 9999, date: dynamicDate,
            title: 'Military Time Test', start_datetime: `${dynamicDate} 14:00:00`,
            start_fmt: '14:00', end_fmt: '15:00', cat_color: '#3498db'
        });
        
        document.getElementById('hoa-calendar-app').removeAttribute('data-render-complete');
        window.render();
    });
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    const eventText = await page.evaluate(() => {
        const ev = Array.from(document.querySelectorAll('.event-item')).find(el => el.textContent.includes('Military Time Test'));
        return ev ? ev.textContent.trim() : null;
    });

    expect(eventText).toBeDefined();
    expect(eventText).toContain('14:00'); // Should not be stripped to "14"
  });


  // =========================================================================
  // TEST 21: First Day of Week Shift & Boundary Safety
  // =========================================================================
  test('TEST 21: First Day of Week Shift & Boundary Safety', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 21 -- Day Shift Safety");
    console.log("========================================================");

    const stdMonth = await findNonSplitMonth();
    await page.goto(`/calendar/?viewDate=${stdMonth.viewMonthRoot}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // 1. Find position among ALL grid cells (including empty padding)
    let firstCellIndex = await page.evaluate((tgt) => {
        const cells = Array.from(document.querySelectorAll('#calendar-grid .calendar-day'));
        return cells.findIndex(c => c.dataset.date === tgt);
    }, stdMonth.firstDay);

    // 2. Inject Monday Start setting
    await setSandboxOption(page, 'hoa_start_day', '1');

    await page.evaluate(() => {
        document.getElementById('hoa-calendar-app').removeAttribute('data-render-complete');
        window.render();
    });
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // 3. Find position again to verify shift
    let shiftedCellIndex = await page.evaluate((tgt) => {
        const cells = Array.from(document.querySelectorAll('#calendar-grid .calendar-day'));
        return cells.findIndex(c => c.dataset.date === tgt);
    }, stdMonth.firstDay);

    // If Sunday start was index 5, Monday start must shift to index 4.
    const expectedShift = (firstCellIndex === 0) ? 6 : firstCellIndex - 1;
    expect(shiftedCellIndex).toBe(expectedShift);
  });

});


// =========================================================================
// TEST 22: Recurring Series with an End Date (UNTIL boundary)
// =========================================================================
  test('TEST 22: Recurring Series with an End Date (UNTIL boundary)', async ({ page }) => {
    console.log("\n========================================================");
    console.log("TEST 22 -- Series End Date (UNTIL)");
    console.log("========================================================");

    // 1. Calculate target dates in the safe NEXT_MONTH window
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Find the first Wednesday of next month
    let firstWed = new Date(nextMonth);
    while (firstWed.getDay() !== 3) { firstWed.setDate(firstWed.getDate() + 1); }

    // Calculate the 3rd and 4th Wednesdays
    const thirdWed = new Date(firstWed);
    thirdWed.setDate(thirdWed.getDate() + 14);

    const fourthWed = new Date(firstWed);
    fourthWed.setDate(fourthWed.getDate() + 21);

    const formatDt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const firstWedStr = formatDt(firstWed);
    const thirdWedStr = formatDt(thirdWed);
    const fourthWedStr = formatDt(fourthWed);

    const targetHorizon = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    await page.goto(`/calendar/?viewDate=${targetHorizon}&pw_nocache=${Date.now()}`);
    await page.waitForSelector('#hoa-calendar-app[data-render-complete="true"]');

    // 2. Open Modal on First Wednesday
    const dayCell = page.locator(`.calendar-day[data-date="${firstWedStr}"]`).first();
    await dayCell.hover({ force: true });
    await dayCell.locator('.add-event-plus').first().evaluate(el => el.click());

    const modal = page.locator('#hoa-edit-modal');
    await expect(modal).toBeVisible();

    // 3. Fill out the form
    await modal.locator('input[name="title"]').fill('Summer Volleyball');
    await modal.locator('#is_repeating').check();
    await expect(modal.locator('#rr-builder-panel')).toBeVisible();

    // Set to repeat on Wednesdays
    await modal.locator('.rr-day[value="WE"]').check();

    // Set the UNTIL date to the Third Wednesday
    await modal.locator('#rr-until').fill(thirdWedStr);

    // Save
    await modal.locator('.hoa-save-btn').click();
    await expect(modal).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#hoa-calendar-app[data-render-complete="true"]')).toBeVisible({ timeout: 10000 });

    // 4. Verify Frontend Render Boundary
    // Should exist on 1st and 3rd Wednesday
    await expect(page.locator(`.calendar-day[data-date="${firstWedStr}"] .event-item`).filter({ hasText: 'Summer Volleyball' })).toBeVisible();
    await expect(page.locator(`.calendar-day[data-date="${thirdWedStr}"] .event-item`).filter({ hasText: 'Summer Volleyball' })).toBeVisible();

    // Should NOT exist on 4th Wednesday
    // (Check if 4th Wed is still in the same month horizon so it's on screen)
    if (fourthWed.getMonth() === firstWed.getMonth()) {
        await expect(page.locator(`.calendar-day[data-date="${fourthWedStr}"] .event-item`).filter({ hasText: 'Summer Volleyball' })).toHaveCount(0);
    }

    // 5. Verify Backend DB State
    // Find the event ID in memory
    const targetEventId = await page.evaluate(() => {
        const ev = window.allEvents.find(e => e.title === "Summer Volleyball");
        return parseInt(ev.pivot_id || ev.id, 10);
    });

    const dbState = await page.evaluate(async (mId) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_db_state&master_id=${mId}`, { headers: { 'X-WP-Nonce': window.hoa_config.nonce } });
        return (await res.json()).data.db_state;
    }, targetEventId);

    // Verify the UNTIL string was correctly formatted and appended
    const formattedUntil = thirdWedStr.replace(/-/g, '') + 'T235959';
    expect(dbState.master.rrule).toContain(`UNTIL=${formattedUntil}`);
    console.log(`[DB TRACE] UNTIL boundary successful. RRule is: ${dbState.master.rrule}`);
  });



/********************************************
 *     Helper functions
 *******************************************/

/**
 * Dynamically computes the target test dates for split-grid variations
 * strictly bounded by the live compiler time window.
 * supports both Sunday (0) and Monday (1) start settings.
 * First day of week Sunday:
 *   1st is Friday,   31 days -- Split 24/31 (lower left)
 *   1st is Saturday, 30 days -- Split 23/30 (lower left)
 *   1st is Saturday, 31 days -- Split 1/8 (upper right)
 * First day of week Monday:
 *   1st is Saturday, 31 days -- Split 1/8 AND Split 2/9 (upper right)
 *   1st is Sunday,   30 days -- Split 1/8 (upper right)
 *   1st is Sunday,   31 days -- Split 1/8 (upper right)
 * 
 * @param {Page} page - Playwright page context instance
 * @param {number} condition - 1, 2, or 3
 * @param {number} startDaySetting - 0 for Sunday start, 1 for Monday start
 * @returns {Promise<{viewMonthRoot: string, topDay: string, bottomDay: string}>}
 */
async function calculateValidSplitHorizon(page, condition, startDaySetting = 0) {
    const bounds = await page.evaluate(() => {
        return {
            min: window.fsbMinTime ? window.fsbMinTime : Date.now(),
            max: window.fsbMaxTime ? window.fsbMaxTime : Date.now() + 31536000000
        };
    });

    const minDate = new Date(bounds.min);
    const maxDate = new Date(bounds.max);

    const minMonthKey = (minDate.getFullYear() * 12) + minDate.getMonth();
    const maxMonthKey = (maxDate.getFullYear() * 12) + maxDate.getMonth();

    let currentMonthKey = minMonthKey;

    while (currentMonthKey <= maxMonthKey) {
        const y = Math.floor(currentMonthKey / 12);
        const m = currentMonthKey % 12;

        const testDate = new Date(y, m, 1);
        const startDayOfWeek = testDate.getDay(); // 0 = Sunday, 6 = Saturday
        const totalDays = new Date(y, m + 1, 0).getDate();
        const monthStr = String(m + 1).padStart(2, '0');

        if (startDaySetting === 0) {
            // SUNDAY START CONDITIONS
            if (condition === 1 && totalDays === 31 && startDayOfWeek === 5) {
                return { viewMonthRoot: `${y}-${monthStr}-01`, topDay: `${y}-${monthStr}-24`, bottomDay: `${y}-${monthStr}-31` };
            }
            if (condition === 2 && totalDays === 30 && startDayOfWeek === 6) {
                return { viewMonthRoot: `${y}-${monthStr}-01`, topDay: `${y}-${monthStr}-23`, bottomDay: `${y}-${monthStr}-30` };
            }
            if (condition === 3 && totalDays === 31 && startDayOfWeek === 6) {
                return { viewMonthRoot: `${y}-${monthStr}-01`, topDay: `${y}-${monthStr}-01`, bottomDay: `${y}-${monthStr}-08` };
            }
        } else if (startDaySetting === 1) {
            // MONDAY START CONDITIONS
            if (condition === 1 && totalDays === 31 && startDayOfWeek === 6) {
                // This is the Double Split! (1/8 AND 2/9)
                return {
                    viewMonthRoot: `${y}-${monthStr}-01`,
                    topDay: `${y}-${monthStr}-01`, bottomDay: `${y}-${monthStr}-08`,
                    topDay2: `${y}-${monthStr}-02`, bottomDay2: `${y}-${monthStr}-09`
                };
            }
            if (condition === 2 && totalDays === 30 && startDayOfWeek === 0) {
                return { viewMonthRoot: `${y}-${monthStr}-01`, topDay: `${y}-${monthStr}-01`, bottomDay: `${y}-${monthStr}-08` };
            }
            if (condition === 3 && totalDays === 31 && startDayOfWeek === 0) {
                return { viewMonthRoot: `${y}-${monthStr}-01`, topDay: `${y}-${monthStr}-01`, bottomDay: `${y}-${monthStr}-08` };
            }
        }
        currentMonthKey++;
    }
    throw new Error(`Not Found, skipped`);
}

// =========================================================================
// Helper: Find any month with NO splits, in the future (Standard Month)
// =========================================================================
async function findNonSplitMonth() {
    const today = new Date();
    const startMonthKey = (today.getFullYear() * 12) + today.getMonth() + 1;
    let currentMonthKey = startMonthKey;
    while (currentMonthKey < startMonthKey + 24) { // Look ahead 2 years to be safe
        const y = Math.floor(currentMonthKey / 12);
        const m = currentMonthKey % 12;
        const testDate = new Date(y, m, 1);
        const startDayOfWeek = testDate.getDay();
        const totalDays = new Date(y, m + 1, 0).getDate();

        // Check if it triggers ANY of the 6 possible split conditions
        const isSun1 = (startDayOfWeek === 5 && totalDays === 31);
        const isSun2 = (startDayOfWeek === 6 && totalDays === 30);
        const isSun3 = (startDayOfWeek === 6 && totalDays === 31);
        const isMon1 = (startDayOfWeek === 6 && totalDays === 31);
        const isMon2 = (startDayOfWeek === 0 && totalDays === 30);
        const isMon3 = (startDayOfWeek === 0 && totalDays === 31);

        // If it triggers NONE of the splits, it's a perfect universal standard month!
        if (!isSun1 && !isSun2 && !isSun3 && !isMon1 && !isMon2 && !isMon3) {
            const monthStr = String(m + 1).padStart(2, '0');
            return {
                viewMonthRoot: `${y}-${monthStr}-01`,
                firstDay: `${y}-${monthStr}-01`,
                midDay: `${y}-${monthStr}-15`,
                lastDay: `${y}-${monthStr}-${totalDays}`
            };
        }
        currentMonthKey++;
    }
    throw new Error("No standard month found within next 24 months.");
}


//  =========================================================================
//  Helper: Create a non-repeating event on this day, at default time.
//          Day could be standard or split.
//  =========================================================================
async function createTestEvent(page, targetDate, title) {
    const targetArea = page.locator(`.day-content[data-date="${targetDate}"]`).first();

    // 1. Check structural class to route interaction
    const isSplitTop = await targetArea.evaluate(el => el.classList.contains('split-half-top'));
    const isSplitBottom = await targetArea.evaluate(el => el.classList.contains('split-half-bottom'));

    let interactNode = targetArea;

    if (isSplitTop) {
        await targetArea.hover({ position: { x: 10, y: 10 }, force: true });
        interactNode = page.locator('.hoa-ghost-shard.shard-top').first();
    } else if (isSplitBottom) {
        const box = await targetArea.boundingBox();
        await targetArea.hover({ position: { x: box.width - 10, y: box.height - 10 }, force: true });
        interactNode = page.locator('.hoa-ghost-shard.shard-bottom').first();
    } else {
        await targetArea.hover({ force: true });
    }

    // 2. Perform Native Playwright interaction on the active UI layer
    await interactNode.locator('.add-event-plus').first().evaluate(el => el.click());

    // 3. Complete the flow
    const editModal = page.locator('#hoa-edit-modal');
    await expect(editModal).toBeVisible();
    await editModal.locator('input[name="title"]').first().fill(title);

    await editModal.locator('.hoa-save-btn').first().click();
    await expect(editModal).toBeHidden({ timeout: 5000 });

    // 4. Verify rendering
    const appWrapper = page.locator('#hoa-calendar-app[data-render-complete="true"]');
    await expect(appWrapper).toBeVisible({ timeout: 10000 });

    // We use toBeAttached here because split cell backgrounds might be masked via CSS
    const freshlyRenderedEvent = targetArea.locator('.event-item').filter({ hasText: title }).first();
    await expect(freshlyRenderedEvent).toBeAttached({ timeout: 5000 });
}

//  =========================================================================
//  Helper: Verify Day Modal Routing
//  =========================================================================
async function verifyDayModal(page, targetDate, expectedTitle) {
    const targetArea = page.locator(`.day-content[data-date="${targetDate}"]`).first();

    const isSplitTop = await targetArea.evaluate(el => el.classList.contains('split-half-top'));
    const isSplitBottom = await targetArea.evaluate(el => el.classList.contains('split-half-bottom'));

    let interactNode = targetArea;

    if (isSplitTop) {
        await targetArea.hover({ position: { x: 10, y: 10 }, force: true });
        interactNode = page.locator('.hoa-ghost-shard.shard-top').first();
    } else if (isSplitBottom) {
        const box = await targetArea.boundingBox();
        await targetArea.hover({ position: { x: box.width - 10, y: box.height - 10 }, force: true });
        interactNode = page.locator('.hoa-ghost-shard.shard-bottom').first();
    } else {
        await targetArea.hover({ force: true });
    }

    // Click the day number natively to trigger the modal
    await interactNode.locator('.day-number').first().evaluate(el => el.click());

    const dayModal = page.locator('#hoa-day-modal');
    await expect(dayModal).toBeVisible();

    await expect(dayModal.locator(`text="${expectedTitle}"`).first()).toBeVisible();

    await dayModal.locator('.close-modal, button:has-text("Close")').first().click();
    await expect(dayModal).toBeHidden();
}

// =========================================================================
// Helper: Force HTML5 Drag and Drop events natively in the browser
// =========================================================================
async function forceDrag(sourceLocator, targetLocator, shiftKey = false) {
    const targetHandle = await targetLocator.elementHandle();
    await sourceLocator.evaluate(async (srcNode, { tgtNode, shift }) => {
        // Create a synthetic data transfer object
        const dt = new DataTransfer();
        const init = { bubbles: true, cancelable: true, dataTransfer: dt };
        
        // Define a helper to attach the Shift key state if needed
        const dispatch = (node, type) => {
            const event = new DragEvent(type, init);
            if (shift) Object.defineProperty(event, 'shiftKey', { get: () => true });
            node.dispatchEvent(event);
        };

        // 1. Start the drag
        dispatch(srcNode, 'dragstart');
        
        // 2. Enter and hover over the target zone
        dispatch(tgtNode, 'dragenter');
        dispatch(tgtNode, 'dragover');
        
        // CRITICAL: Pause for 100ms to allow your reddish CSS drop zone to activate!
        await new Promise(r => setTimeout(r, 100));
        
        // 3. Drop the payload and end the drag
        dispatch(tgtNode, 'drop');
        dispatch(srcNode, 'dragend');
        
    }, { tgtNode: targetHandle, shift: shiftKey });
}


/**
 * Asks the PHP Backend to compute the exact date of the Nth instance of an RRule.
 * Guarantees that Playwright and PHP use the exact same temporal math.
 * * @param {Page} page - Playwright page context instance
 * @param {number|string} eventId - The ID of the Master or Pivot record
 * @param {number} n - 0-indexed instance (0 = first occurrence)
 * @returns {Promise<string>} YYYY-MM-DD
 */
async function getNthInstanceDate(page, eventId, n) {
    return await page.evaluate(async ({ eId, index }) => {
        const res = await fetch(`/wp-admin/admin-ajax.php?action=hoa_run_regression_step&step=get_nth_instance&pivot_id=${eId}&n=${index}`, {
            headers: { 'X-WP-Nonce': window.hoa_config.nonce }
        });
        const result = await res.json();
        if (!result.success) throw new Error(`Backend RRule Math Failed: ${result.data}`);
        return result.data.date;
    }, { eId: eventId, index: n });
}


/**
 * Synchronizes a setting change across BOTH the backend Shadow State and the frontend config.
 * * @param {Page} page - Playwright page context instance
 * @param {string} optName - The WordPress option key (e.g., 'hoa_start_day')
 * @param {string} optVal - The new value (e.g., '1')
 */
async function setSandboxOption(page, optName, optVal) {
    await page.evaluate(async ({ name, val }) => {
        // 1. Tell the PHP Backend to update the Shadow State
        const fd = new FormData();
        fd.append('action', 'hoa_run_regression_step');
        fd.append('step', 'set_option');
        fd.append('opt_name', name);
        fd.append('opt_val', val);

        await fetch(window.hoa_config.ajax_url, {
            method: 'POST', body: fd, headers: { 'X-WP-Nonce': window.hoa_config.nonce }
        });

        // 2. Tell the JavaScript frontend to update its active configuration
        // Maps 'hoa_start_day' -> 'start_day', 'hoa_time_format' -> 'time_format'
        const jsConfigKey = name.replace('hoa_', '');
        window.hoa_config[jsConfigKey] = val;

    }, { name: optName, val: optVal });
}


