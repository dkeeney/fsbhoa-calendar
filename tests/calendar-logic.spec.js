const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// This test will actually run a set of PHP written tests that check the
// validity of the compiler and it's generation of the .json file from the 
// events in the database.
// These tests are found in includes/TestRunner.php.

test('Run Logic Regression Suite with Deep Logging', async ({ page }, testInfo) => {
  // 1. Setup the log file path inside your new 'tests/test-results' folder
  const logDir = path.join(__dirname, 'test-results');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  const logFilePath = path.join(logDir, 'deep-regression.log');
  
  fs.writeFileSync(logFilePath, `DEEP REGRESSION LOG: ${new Date().toLocaleString()}\n` + '='.repeat(40) + '\n');

  // 2. Navigate to the regression tab
  await page.goto('/wp-admin/admin.php?page=hoa-cal-settings&tab=regression');

  // 3. The "Deep Log" Listener
  // This intercepts the AJAX data coming back from PHP to get the technical details
  page.on('response', async (response) => {
    if (response.url().includes('action=hoa_run_regression_step&step=run_scenario')) {
      try {
        const result = await response.json();
        const url = new URL(response.url());
        const slug = url.searchParams.get('slug');
        
        const logEntry = `\n[${result.success ? 'PASS' : 'FAIL'}] Scenario: ${slug}\n` +
                         `Message: ${result.data.message || result.data}\n` +
                         (result.data.debug ? `Debug Context: ${result.data.debug}\n` : '') +
                         '-'.repeat(30);
        
        fs.appendFileSync(logFilePath, logEntry);
      } catch (e) {
        // Silently skip if response isn't JSON or is malformed
      }
    }
  });

  // 4. Trigger the UI Button
  const runButton = page.locator('#run-regression');
  await runButton.click();

  // 5. Monitor the console for the final completion signal
  const consoleEl = page.locator('#regression-console');
  await expect(consoleEl).toContainText('REGRESSION COMPLETE.', { timeout: 120000 });

  // 6. Final Validation
  const consoleText = await consoleEl.innerText();
  
  // Attach the technical log to the HTML report
  await testInfo.attach('Deep Diagnostic Log', {
    path: logFilePath,
    contentType: 'text/plain',
  });

  if (consoleText.includes('FAIL:')) {
    throw new Error('Regression Suite Failed. View the "Deep Diagnostic Log" in the test report for details.');
  }

  console.log('✅ Regression logic check complete.');
});

