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
    baseURL: 'http://testbed.fsbhoa.com',
    /*baseURL: 'https://192.168.42.62', */
    /*baseURL: 'http://127.0.0.1', */
    /*extraHTTPHeaders: {
      'Host': 'testbed.fsbhoa.com',
    }, */
    storageState: path.join(__dirname, 'state/storageState.json'),
    ignoreHTTPSErrors: true,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on',
    
    /* Since the Pi is headless, we must run headless, 
       but we will view the "Trace" on Windows later. */
    headless: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
