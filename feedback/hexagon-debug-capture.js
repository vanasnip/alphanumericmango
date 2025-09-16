const { chromium } = require('../voice-terminal-hybrid/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs and errors
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page Error:', err.message));
  
  try {
    console.log('Navigating to Storybook...');
    await page.goto('http://localhost:6007', { waitUntil: 'networkidle' });
    
    // Wait for Storybook to load
    await page.waitForTimeout(3000);
    
    console.log('Clicking on HexagonGrid...');
    await page.locator('text=HexagonGrid').first().click();
    await page.waitForTimeout(1000);
    
    console.log('Clicking on Connected Honeycomb...');
    await page.locator('text=Connected Honeycomb').first().click();
    await page.waitForTimeout(3000);
    
    // Check if canvas exists
    const canvas = await page.locator('canvas').count();
    console.log(`Found ${canvas} canvas elements`);
    
    // Check if SVG exists
    const svg = await page.locator('svg').count();
    console.log(`Found ${svg} SVG elements`);
    
    // Check for any divs that might contain the visualization
    const storyRoot = page.locator('#storybook-root');
    const rootContent = await storyRoot.innerHTML();
    console.log('Story root HTML length:', rootContent.length);
    
    // Take screenshot of just the story area
    await storyRoot.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/hexagon-story-area.png' 
    });
    
    // Also check the docs view if available
    try {
      await page.locator('button[title="Open docs tab"]').click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: '/Users/ivan/DEV_/alphanumericmango/feedback/hexagon-docs-view.png', 
        fullPage: true 
      });
    } catch (e) {
      console.log('Docs tab not found or not clickable');
    }
    
    // Try different stories to see if any work
    const stories = ['Single Hexagon', 'Low Amplitude', 'Medium Amplitude', 'Spaced Hexagons'];
    
    for (const story of stories) {
      try {
        console.log(`Trying story: ${story}`);
        await page.locator(`text=${story}`).first().click();
        await page.waitForTimeout(2000);
        
        const storyCanvas = await page.locator('#storybook-root').count();
        if (storyCanvas > 0) {
          await page.locator('#storybook-root').screenshot({ 
            path: `/Users/ivan/DEV_/alphanumericmango/feedback/hexagon-${story.toLowerCase().replace(/\s+/g, '-')}.png` 
          });
        }
      } catch (e) {
        console.log(`Could not find or click story: ${story}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: '/Users/ivan/DEV_/alphanumericmango/feedback/debug-error-state.png' });
  } finally {
    await browser.close();
  }
})();