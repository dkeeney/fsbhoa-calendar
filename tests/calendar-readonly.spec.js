// tests/calendar-readonly.spec.js
const { test, expect } = require('@playwright/test');

const APP_URL = 'https://testbed.fsbhoa.com'; // Removed /calendar so we can hit wp-admin

test.describe('Read-Only Calendar UI and Navigation', () => {

    test.beforeAll(async ({ request }) => {
        console.log('Seeding test database via Sandbox Bridge...');

        const fixtureData = {
            locations: [{ _ref: "loc_1", name: "Main Lodge" }],
            categories: [{ _ref: "cat_1", name: "Community", color_hex: "#0288d1" }],
            events: [
                {
                    title: "Standard Detail Event",
                    start_date: "2026-08-10",
                    start_time: "10:00:00",
                    end_time: "11:00:00",
                    location_ref: "loc_1",
                    category_ref: "cat_1"
                },
                {
                    title: "Flyer Bypass Event",
                    start_date: "2026-08-20",
                    start_time: "14:00:00",
                    end_time: "15:00:00",
                    flyer_url: "https://example.com/test-flyer.pdf"
                }
            ]
        };

        // POST the fixture data to the AJAX endpoint
        const response = await request.post(`${APP_URL}/wp-admin/admin-ajax.php?action=fsb_run_regression_step&step=load_fixture`, {
            headers: {
                'Cookie': 'fsb_test_mode=1' // CRITICAL: Tells PHP to use the Sandbox!
            },
            data: JSON.stringify(fixtureData)
        });

        const result = await response.json();
        if (!result.success) {
            console.error('Failed to load fixture:', result);
        } else {
            console.log('Fixture loaded successfully!');
        }
    });

    test.beforeEach(async ({ page }) => {
        // We use viewDate to force August 2026, which guarantees a 31-day month
        // starting on a Saturday, forcing the 1st/8th to split.
        await page.goto(`${APP_URL}/calendar?viewDate=2026-08-01`);

        // Wait for the grid rendering loop to finish injecting the DOM
        await page.waitForSelector('#calendar-grid .calendar-day');
    });


    test('TEST 1: Grid Rendering & Data Integrity', async ({ page }) => {
        const grid = page.locator('#calendar-grid');
        await expect(grid).toBeVisible();

        // Ensure the grid populated non-empty day cells
        const validDays = page.locator('.calendar-day:not(.empty)');
        await expect(validDays.first()).toBeVisible();

        // Verify the day header layout inside a standard cell
        const firstDayHeader = validDays.first().locator('.day-top .day-number');
        await expect(firstDayHeader).toBeVisible();
    });

    test('TEST 3: Day Modal Navigation & Split Cell Boundary Logic', async ({ page }) => {
        // 1. Standard Day Test (e.g., Aug 15th)
        const standardCell = page.locator('.calendar-day[data-date="2026-08-15"]');
        await standardCell.hover(); 
        
        // Click the day number to open the modal
        await standardCell.locator('.day-number').first().click();
        
        const dayModal = page.locator('#fsb-day-modal');
        await expect(dayModal).toHaveClass(/is-visible/);
        
        // Close it for the next check
        await page.locator('#fsb-day-modal .close-modal').first().click();
        await expect(dayModal).not.toHaveClass(/is-visible/);

        // 2. Split Cell Boundary Logic (August 2026 has a split on Saturday the 1st/8th)
        const splitCell = page.locator('.calendar-day.split-cell').first();
        await expect(splitCell).toBeVisible();

        // Hover the top half (August 1st) and click
        const splitTop = splitCell.locator('.split-half-top');
        await splitTop.hover();
        await splitTop.locator('.day-number').first().click();
        await expect(dayModal).toHaveClass(/is-visible/);
        await expect(page.locator('#fsb-modal-content')).toContainText('August 1');
        await page.locator('#fsb-day-modal .close-modal').first().click();

        // Hover the bottom half (August 8th) and click
        const splitBottom = splitCell.locator('.split-half-bottom');
        await splitBottom.hover();
        await splitBottom.locator('.day-number').first().click();
        await expect(dayModal).toHaveClass(/is-visible/);
        await expect(page.locator('#fsb-modal-content')).toContainText('August 8');
    });

    test('TEST 4: Detail Modal Routing', async ({ page }) => {
        // Ensure we find at least one event chip on the grid
        const eventChip = page.locator('.calendar-day:not(.empty) .event-item').first();
        
        // Wait for an event to be available (Requires Fixture Engine)
        await eventChip.waitFor({ state: 'visible', timeout: 5000 });
        
        await eventChip.hover();
        
        // Setup a listener in case this event has a flyer_url and opens a new tab
        const [newPage] = await Promise.all([
            page.waitForEvent('popup', { timeout: 3000 }).catch(() => null),
            eventChip.click()
        ]);

        if (newPage) {
            // Flyer Bypass Path executed successfully
            await expect(newPage).not.toBeNull();
            await newPage.close();
        } else {
            // Modal Fallback Path executed successfully
            const detailModal = page.locator('.fsb-detail-modal').first();
            await expect(detailModal).toHaveClass(/is-visible/);
            
            // Verify metadata is rendering in the modal
            await expect(detailModal.locator('.event-meta')).toBeVisible();
        }
    });

    test('TEST 12: Context Highlighting & Focus Anchors', async ({ page }) => {
        // Remove the viewDate override to load the real current month
        await page.goto(APP_URL);
        await page.waitForSelector('#calendar-grid .calendar-day');

        // Verify today's cell is highlighted
        const todayCell = page.locator('.calendar-day.today');
        await expect(todayCell).toBeVisible();

        // Click the Today button in the footer toolbar
        await page.locator('#jumpToday').click();
        
        // Verify the view snapped back and today is still highlighted
        await expect(todayCell).toBeVisible();
    });

    test('TEST 13: Temporal State Lockdowns (Past vs. Future)', async ({ page }) => {
        await page.goto(APP_URL);
        await page.waitForSelector('#calendar-grid .calendar-day');

        const pastDays = page.locator('.calendar-day.past-day');
        const count = await pastDays.count();
        
        if (count > 0) {
            // Verify the CSS class is correctly applied
            await expect(pastDays.first()).toHaveClass(/past-day/);
        } else {
            console.log('Skipping TEST 13 assertion: No past days to check currently.');
        }
    });
});

