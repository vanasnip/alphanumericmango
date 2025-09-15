import { test, expect } from '@playwright/test';

test.describe('500 Error Diagnosis @diagnostic', () => {
  test('diagnose 500 error on localhost:5174', async ({ page }) => {
    console.log('Starting 500 error diagnosis...');

    // Set up error and console message collection
    const errors: string[] = [];
    const consoleMessages: { type: string; text: string }[] = [];
    const networkFailures: { url: string; status: number; statusText: string }[] = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
      console.log(`Console ${msg.type()}: ${msg.text()}`);
    });

    // Collect JavaScript errors
    page.on('pageerror', (error) => {
      errors.push(error.toString());
      console.log(`Page error: ${error.toString()}`);
      console.log(`Stack trace: ${error.stack}`);
    });

    // Collect network failures
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkFailures.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
        console.log(`Network failure: ${response.status()} ${response.statusText()} - ${response.url()}`);
      }
    });

    // Navigate to the problematic URL
    console.log('Navigating to http://localhost:5174/...');
    
    try {
      const response = await page.goto('http://localhost:5174/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log(`Response status: ${response?.status()}`);
      console.log(`Response status text: ${response?.statusText()}`);

      if (response?.status() === 500) {
        console.log('500 error confirmed');
        
        // Try to get response body for more details
        try {
          const responseBody = await response.text();
          console.log('Response body:', responseBody.substring(0, 1000));
        } catch (e) {
          console.log('Could not read response body:', e);
        }
      }

    } catch (error) {
      console.log(`Navigation failed: ${error}`);
      errors.push(`Navigation error: ${error}`);
    }

    // Wait a moment for any additional errors to surface
    await page.waitForTimeout(2000);

    // Take a screenshot of the current state
    await page.screenshot({ 
      path: 'test-results/500-error-screenshot.png',
      fullPage: true 
    });

    // Check if there's any content on the page
    const bodyContent = await page.textContent('body').catch(() => '');
    console.log('Page body content preview:', bodyContent.substring(0, 500));

    // Try to find any error messages in the DOM
    const errorElements = await page.locator('*:has-text("error"), *:has-text("Error"), *:has-text("500")').all();
    for (const element of errorElements) {
      const text = await element.textContent();
      console.log('Error element found:', text);
    }

    // Check for SvelteKit specific error indicators
    const svelteKitError = await page.locator('[data-sveltekit-error]').first().textContent().catch(() => null);
    if (svelteKitError) {
      console.log('SvelteKit error:', svelteKitError);
    }

    // Report all collected information
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    console.log('Console messages:', consoleMessages.length);
    console.log('JavaScript errors:', errors.length);
    console.log('Network failures:', networkFailures.length);
    
    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg, i) => {
      console.log(`${i + 1}. [${msg.type}] ${msg.text}`);
    });

    console.log('\n=== JAVASCRIPT ERRORS ===');
    errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });

    console.log('\n=== NETWORK FAILURES ===');
    networkFailures.forEach((failure, i) => {
      console.log(`${i + 1}. ${failure.status} ${failure.statusText} - ${failure.url}`);
    });

    // Check if the server is actually running
    const serverRunning = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:5174/favicon.ico');
        return { running: true, status: response.status };
      } catch (e) {
        return { running: false, error: e.toString() };
      }
    }).catch(() => ({ running: false, error: 'Could not check server' }));

    console.log('\n=== SERVER STATUS ===');
    console.log('Server running:', serverRunning);

    // Don't fail the test - this is purely diagnostic
    expect(true).toBe(true);
  });
});