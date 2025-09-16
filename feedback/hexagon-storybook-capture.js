const { chromium } = require('../voice-terminal-hybrid/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to Storybook...');
    await page.goto('http://localhost:6007', { waitUntil: 'networkidle' });
    
    // Wait for Storybook to load
    await page.waitForTimeout(3000);
    
    console.log('Looking for HexagonGrid in sidebar...');
    
    // Try different selectors for HexagonGrid
    const possibleSelectors = [
      'text=HexagonGrid',
      '[data-item-id*="hexagon"]',
      '[data-item-id*="Hexagon"]',
      '.sidebar-item:has-text("Hexagon")',
      'a:has-text("HexagonGrid")',
      'button:has-text("HexagonGrid")'
    ];
    
    let hexagonGridFound = false;
    
    for (const selector of possibleSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`Found HexagonGrid with selector: ${selector}`);
          await element.click();
          hexagonGridFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!hexagonGridFound) {
      console.log('HexagonGrid not found, taking screenshot of current page...');
      await page.screenshot({ path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-sidebar.png', fullPage: true });
      
      // Try to expand all folders first
      const expandButtons = page.locator('[aria-label="Expand"]');
      const count = await expandButtons.count();
      console.log(`Found ${count} expand buttons`);
      
      for (let i = 0; i < count; i++) {
        try {
          await expandButtons.nth(i).click();
          await page.waitForTimeout(500);
        } catch (e) {
          // Continue
        }
      }
      
      // Try again after expanding
      for (const selector of possibleSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`Found HexagonGrid after expanding: ${selector}`);
            await element.click();
            hexagonGridFound = true;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    if (hexagonGridFound) {
      console.log('Waiting for story to load...');
      await page.waitForTimeout(2000);
      
      // Look for ConnectedHoneycomb story
      const storySelectors = [
        'text=ConnectedHoneycomb',
        'text=Connected Honeycomb',
        '[data-item-id*="connected"]',
        '[data-item-id*="honeycomb"]'
      ];
      
      for (const selector of storySelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            console.log(`Found ConnectedHoneycomb story with selector: ${selector}`);
            await element.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          // Continue
        }
      }
      
      console.log('Taking screenshot of current state...');
      await page.screenshot({ 
        path: '/Users/ivan/DEV_/alphanumericmango/feedback/hexagon-current-state.png', 
        fullPage: true 
      });
      
      // Also take a screenshot focused on the canvas/story area
      const canvas = page.locator('#storybook-root, .docs-story, [data-testid="story-canvas"]').first();
      if (await canvas.isVisible()) {
        await canvas.screenshot({ 
          path: '/Users/ivan/DEV_/alphanumericmango/feedback/hexagon-canvas-only.png' 
        });
      }
      
    } else {
      console.log('Could not find HexagonGrid component');
      // Take a screenshot of the full sidebar to see what's available
      await page.screenshot({ 
        path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-full-sidebar.png', 
        fullPage: true 
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: '/Users/ivan/DEV_/alphanumericmango/feedback/error-state.png' });
  } finally {
    await browser.close();
  }
})();