const { chromium } = require('playwright');

async function captureHexagonGrid() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to Storybook
    await page.goto('http://localhost:6007');
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Look for HexagonGrid in the sidebar
    await page.click('text=HexagonGrid');
    
    // Wait for the story to load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/hexagon-still-broken.png',
      fullPage: true
    });
    
    console.log('Screenshot saved as hexagon-still-broken.png');
    
  } catch (error) {
    console.error('Error capturing screenshot:', error);
  } finally {
    await browser.close();
  }
}

captureHexagonGrid();