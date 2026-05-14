const { test, expect } = require('@playwright/test');

test('Verify Calendar Title', async ({ page }) => {
  // Go to your testbed URL
  await page.goto('/calendar/');

  const title = await page.title();
  console.log('The page title is:', title);

  // Expect the page to have the title you configured (FSBHOA Calendar)
  // Adjust the regex below to match your actual <title> tag
  //await expect(page).toHaveTitle(/FSBHOA/);
  const calendar = page.locator('.fsb-calendar-app');
  await expect(calendar).toBeVisible();
});

