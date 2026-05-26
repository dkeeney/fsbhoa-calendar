const { test } = require('@playwright/test');

test('Debug the Calendar URL', async ({ page }) => {
    console.log('Navigating to /calendar ...');
    const response = await page.goto('/calendar');
    
    console.log('--- PLAYWRIGHT SEES ---');
    console.log('Final URL:', page.url());
    console.log('HTTP Status:', response.status());
    console.log('Page Title:', await page.title());
    
    const gridCount = await page.locator('#calendar-grid').count();
    console.log('Found #calendar-grid elements:', gridCount);

    if (gridCount === 0) {
        console.log('Grid is missing! Dumping the page body text to see where we are:');
        const bodyText = await page.locator('body').innerText();
        console.log(bodyText.substring(0, 500)); // Print first 500 chars
    }
});

