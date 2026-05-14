// tests/calendar-admin.spec.js
const { test, expect } = require('@playwright/test');

test('Admin can see the Edit Event button', async ({ page }) => {
  await page.goto('http://testbed.fsbhoa.com/calendar/', { waitUntil: 'networkidle' });
  
  // Replace '.fsb-edit-btn' with your actual CSS class/ID for the edit button
  const editButton = page.locator('.fsb-edit-btn');
  
  await expect(editButton).toBeVisible();
});

