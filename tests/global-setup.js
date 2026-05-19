// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async (config) => {
  //const { baseURL, storageState, extraHTTPHeaders } = config.projects[0].use;
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  //const context = await browser.newContext({ extraHTTPHeaders, ignoreHTTPSErrors: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    // 1. Navigate to the login page
    console.log(`Logging in via: ${baseURL}/wp-login.php`);
    await page.goto(`${baseURL}/wp-login.php`, { waitUntil: 'networkidle' });

    // 2. Fill in credentials (replace with your actual test credentials)
    await page.fill('#user_login', 'admin');
    await page.fill('#user_pass', 'bakersfield123');
    
    // 3. Click "Remember Me" to ensure the cookie persists
    await page.click('#rememberme');
    
    // 4. Submit and wait for the dashboard to load
    await page.click('#wp-submit');

    // Wait specifically for the WordPress auth cookie to hit the browser context
    // We check every 500ms for 10 seconds
    let loggedIn = false;
    for (let i = 0; i < 20; i++) {
        const cookies = await page.context().cookies();
        if (cookies.some(c => c.name.includes('wordpress_logged_in'))) {
            loggedIn = true;
            break;
        }
        await page.waitForTimeout(500);
    }
    if (!loggedIn) {
        throw new Error("Login failed: wordpress_logged_in cookie never appeared.");
    }

    // Inject the Sandbox Cookie
    await page.context().addCookies([{
        name: 'fsb_test_mode',
        value: '1',
        domain: 'testbed.fsbhoa.com', // MUST match your testing domain
        path: '/'
    }]);

    // 5. Save the authenticated state (cookies and localStorage)
    await page.context().storageState({ path: storageState });
    console.log('Login successful. storageState.json created.');
  } catch (error) {
    await page.screenshot({ path: 'login-failed.png' });
    console.error('Login failed. Check credentials or VPN connection.', error);
  } finally {
    await browser.close();
  }
};
