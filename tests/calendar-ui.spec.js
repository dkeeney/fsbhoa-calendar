const { test, expect } = require('@playwright/test');

const CALENDAR_URL = 'http://192.168.1.190/calendar/';

test.describe('FSBHOA Calendar UI', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the calendar page before each test
    await page.goto(CALENDAR_URL);
    // Wait for the main app container to be visible to ensure the page is ready
    await expect(page.locator('#fsb-calendar-app')).toBeVisible();
  });

  test('should load the calendar and navigate months', async ({ page }) => {
    const monthDisplay = page.locator('#currentMonthDisplay');
    const initialMonthText = await monthDisplay.textContent();

    // Navigate to the next month
    await page.locator('#nextMonth').click();
    await expect(monthDisplay).not.toHaveText(initialMonthText);

    // Navigate back to the previous (initial) month
    await page.locator('#prevMonth').click();
    await expect(monthDisplay).toHaveText(initialMonthText);
  });

  test('should open the day modal when a day cell is clicked', async ({ page }) => {
    const dayModal = page.locator('#fsb-day-modal');
    await expect(dayModal).not.toHaveClass(/is-visible/);

    // Click the first non-empty calendar day
    await page.locator('.calendar-day:not(.empty)').first().click();

    // Assert that the modal is now visible
    await expect(dayModal).toHaveClass(/is-visible/);
  });

  test('should open the edit modal when an edit pencil is clicked', async ({ page }) => {
    const editModal = page.locator('#fsb-edit-modal');
    await expect(editModal).not.toHaveClass(/is-visible/);

    // Click the first available edit pencil icon on an event
    // This assumes at least one event is rendered for the test user
    const firstPencil = page.locator('.edit-pencil').first();
    await expect(firstPencil).toBeVisible();
    await firstPencil.click();

    // Assert that the edit modal is now visible
    await expect(editModal).toHaveClass(/is-visible/);
  });

  test('should toggle the recurrence panel in the edit modal', async ({ page }) => {
    // Open the edit modal first by clicking a pencil
    await page.locator('.edit-pencil').first().click();
    await expect(page.locator('#fsb-edit-modal')).toBeVisible();

    const recurrenceCheckbox = page.locator('#is_repeating');
    const recurrencePanel = page.locator('#rr-builder-panel');

    // Assuming the event is recurring, the panel should be visible initially.
    await expect(recurrencePanel).toBeVisible();

    // Set up a listener to automatically accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Uncheck the box to hide the panel
    await recurrenceCheckbox.uncheck();
    await expect(recurrencePanel).toBeHidden();

    // Check the box again to show the panel
    await recurrenceCheckbox.check();
    await expect(recurrencePanel).toBeVisible();
  });

});
