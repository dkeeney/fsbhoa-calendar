import { test, expect } from '@playwright/test';

test.describe('Calendar Forms and Modals', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the calendar page.
    // We target a specific future month to ensure a consistent state.
    await page.goto('/calendar?viewDate=2026-06-01');
    // Wait for the grid and the correct background image to be rendered.
    await expect(page.locator('#calendar-grid .calendar-day')).toHaveCount(35);
    await expect(page.locator('#fsb-calendar-app')).toHaveAttribute('style', /cal-2026-06\.png/);
  });

  test('TEST 2: Admin can open "Add Event" modal', async ({ page }) => {
    const testDate = '2026-06-10';
    const dayCell = page.locator(`.calendar-day[data-date="${testDate}"]`);
    
    // Hover to reveal admin controls
    await dayCell.hover();
    
    const addIcon = dayCell.locator('.add-event-plus');
    await expect(addIcon).toBeVisible();
    await addIcon.click();

    const editModal = page.locator('#fsb-edit-modal');
    await expect(editModal).toBeVisible();

    // Assert the modal is initialized for the correct date
    const dateInput = editModal.locator('input[name="date"]');
    await expect(dateInput).toHaveValue(testDate);

    // Assert that management buttons are absent in creation mode
    await expect(editModal.locator('button:has-text("Cancel Event")')).not.toBeVisible();
    await expect(editModal.locator('button:has-text("Reschedule")')).not.toBeVisible();
  });
  
  test('TEST 5: Edit pencils appear and open the "Edit Event" modal', async ({ page }) => {
    const testDate = '2026-06-01'; // A Monday with a "Simple Series" event
    const dayCell = page.locator(`.calendar-day[data-date="${testDate}"]`);
    
    await dayCell.hover();
    
    const eventItem = dayCell.locator('.event-item:has-text("Simple Series")');
    const editPencil = eventItem.locator('.edit-pencil');
    await expect(editPencil).toBeVisible();
    await editPencil.click();

    const editModal = page.locator('#fsb-edit-modal');
    await expect(editModal).toBeVisible();

    // Assert the modal is populated with the event's data
    const titleInput = editModal.locator('input[name="title"]');
    await expect(titleInput).toHaveValue('Simple Series');
  });
  
  test('TEST 6: Edit Modal RRule builder works bi-directionally', async ({ page }) => {
    const testDate = '2026-06-10';
    const dayCell = page.locator(`.calendar-day[data-date="${testDate}"]`);
    await dayCell.hover();
    await dayCell.locator('.add-event-plus').click();

    const modal = page.locator('#fsb-edit-modal');
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

    // Part 2: Test reverse-engineering an existing RRule
    await modal.locator('.close-modal').click();
    await expect(modal).not.toBeVisible();

    const existingEventCell = page.locator(`.calendar-day[data-date="2026-06-01"]`);
    await existingEventCell.hover();
    await existingEventCell.locator('.event-item .edit-pencil').click();
    await expect(modal).toBeVisible();

    await expect(modal.locator('#rrule_input')).toHaveValue('FREQ=WEEKLY;BYDAY=MO');
    await expect(modal.locator('.rr-day[value="MO"]')).toBeChecked();
    await expect(modal.locator('.rr-day[value="TU"]')).not.toBeChecked();

    // Handle the confirmation dialog when unchecking an existing series
    page.on('dialog', dialog => dialog.accept());
    await modal.locator('#is_repeating').uncheck();
    await expect(modal.locator('#rrule_input')).toHaveValue('');
  });
  
  test('TEST 7: "Cancel Event" on a single event shows correct options', async ({ page }) => {
    // Navigate to July to find the single event
    await page.goto('/calendar?viewDate=2026-07-01');
    const dayCell = page.locator(`.calendar-day[data-date="2026-07-04"]`);
    await dayCell.hover();
    await dayCell.locator('.event-item .edit-pencil').click();

    await expect(page.locator('#fsb-edit-modal')).toBeVisible();
    await page.locator('button:has-text("Cancel Event")').click();

    const manageModal = page.locator('#fsb-manage-modal');
    await expect(manageModal).toBeVisible();
    await expect(manageModal.locator('button:has-text("Delete Event Forever")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("Cancel ONLY this instance")')).not.toBeVisible();
  });
  
  test('TEST 8: "Cancel Event" on a recurring event shows correct options', async ({ page }) => {
    const dayCell = page.locator(`.calendar-day[data-date="2026-06-01"]`);
    await dayCell.hover();
    await dayCell.locator('.event-item .edit-pencil').click();

    await expect(page.locator('#fsb-edit-modal')).toBeVisible();
    await page.locator('button:has-text("Cancel Event")').click();
    
    const manageModal = page.locator('#fsb-manage-modal');
    await expect(manageModal).toBeVisible();
    
    await expect(manageModal.locator('button:has-text("Cancel ONLY this instance")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("Restore or Undelete Next Cancelled Instance")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("End series starting today")')).toBeVisible();
    await expect(manageModal.locator('button:has-text("DELETE ENTIRE SERIES & HISTORY")')).toBeVisible();
  });
  
  test('TEST 9: "Reschedule" button opens the reschedule modal with correct options', async ({ page }) => {
    // Part 1: Test with a recurring event
    const recurringCell = page.locator(`.calendar-day[data-date="2026-06-01"]`);
    await recurringCell.hover();
    await recurringCell.locator('.event-item .edit-pencil').click();
    
    const editModal = page.locator('#fsb-edit-modal');
    await expect(editModal).toBeVisible();
    await editModal.locator('button:has-text("Reschedule")').click();

    const rescheduleModal = page.locator('#fsb-reschedule-modal');
    await expect(rescheduleModal).toBeVisible();
    await expect(rescheduleModal.locator('input[name="res_scope"][value="instance"]')).toBeVisible();
    await expect(rescheduleModal.locator('input[name="res_scope"][value="remaining"]')).toBeVisible();
    await rescheduleModal.locator('.close-modal').click();
    await expect(rescheduleModal).not.toBeVisible();

    // Part 2: Test with a single event
    await page.goto('/calendar?viewDate=2026-07-01');
    const singleCell = page.locator(`.calendar-day[data-date="2026-07-04"]`);
    await singleCell.hover();
    await singleCell.locator('.event-item .edit-pencil').click();
    await expect(editModal).toBeVisible();
    await editModal.locator('button:has-text("Reschedule")').click();
    
    await expect(rescheduleModal).toBeVisible();
    await expect(rescheduleModal.locator('p:has-text("* This move only affects this specific event.")')).toBeVisible();
    await expect(rescheduleModal.locator('input[name="res_scope"]')).not.toBeVisible();
  });
  
  test('TEST 14: Form validation prevents saving an event with no title', async ({ page }) => {
    const dayCell = page.locator(`.calendar-day[data-date="2026-06-10"]`);
    await dayCell.hover();
    await dayCell.locator('.add-event-plus').click();
    
    const modal = page.locator('#fsb-edit-modal');
    await expect(modal).toBeVisible();
    
    // Clear the title field (which is required)
    await modal.locator('input[name="title"]').fill('');
    
    await modal.locator('.fsb-save-btn').click();
    
    // The browser's HTML5 validation should prevent the form submission,
    // so the modal should remain visible.
    await expect(modal).toBeVisible();

    // Also verify no new event was created by checking for its absence
    await modal.locator('.close-modal').click();
    await expect(dayCell.locator('.event-item')).toHaveCount(0);
  });
  
});
