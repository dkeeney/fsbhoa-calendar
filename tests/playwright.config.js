const { defineConfig, devices } = require('@playwright/test');
const path = require('path');


module.exports = defineConfig({
  testDir: '.',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on file system (optional for Pi performance) */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  // Moves 'test-results' into tests/test-results
  outputDir: './test-results',

  reporter: [
    ['html', {
      // Moves 'playwright-report' into tests/playwright-report
      outputFolder: './playwright-report',
      open: 'never'
    }]
  ],

  globalSetup: require.resolve('./global-setup'),
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'https://testbed.fsbhoa.com',
    viewport: { width: 1280, height: 800 },
    storageState: path.join(__dirname, 'state/storageState.json'),
    ignoreHTTPSErrors: true,
    trace: 'on',
    headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
