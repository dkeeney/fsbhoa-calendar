const { test, expect } = require('@playwright/test');

const CALENDAR_URL = 'https://testbed.fsbhoa.com/calendar/';

test.describe('FSBHOA Calendar UI', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Go to the standard WordPress login page
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    
    await page.goto('https://testbed.fsbhoa.com/wp-login.php');

    // 2. Fill in the credentials
    // IMPORTANT: Replace these with your actual testbed login info!
    await page.locator('#user_login').fill('admin');
    await page.waitForTimeout(500); // Wait half a second
    await page.locator('#user_pass').fill('bakersfield123');
    await page.waitForTimeout(500); // Wait half a second
    
    // 3. Click the login button
    await page.locator('#wp-submit').click();
    

    // Wait for WordPress to process the login and set the cookies
    // (We wait for the network to settle down before moving on)
    await page.waitForLoadState('networkidle');

    // 4. Now navigate to the calendar page
    await page.goto(CALENDAR_URL);

    // Wait for the main app container to be visible to ensure the page is ready
    await expect(page.locator('#fsb-calendar-app')).toBeVisible();
  });

  test('should load the calendar and navigate months', async ({ page }) => {
    // Grab the very first day cell on the grid
    const firstDayCell = page.locator('.calendar-day:not(.empty)').first();
    const initialDate = await firstDayCell.getAttribute('data-date');

    // Navigate to the next month
    await page.locator('#nextMonth').click();

    // The data-date attribute of the first cell should now be different
    await expect(firstDayCell).not.toHaveAttribute('data-date', initialDate);

    // Navigate back
    await page.locator('#prevMonth').click();
    await expect(firstDayCell).toHaveAttribute('data-date', initialDate);
  });

  test('should open the day modal when a day cell is clicked', async ({ page }) => {
    const dayModal = page.locator('#fsb-day-modal');
    await expect(dayModal).not.toHaveClass(/is-visible/);

    // Click the first non-empty calendar day
    await page.locator('.calendar-day .day-number').first().click();

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
