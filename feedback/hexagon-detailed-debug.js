const { chromium } = require('../voice-terminal-hybrid/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enhanced console and error tracking
  const consoleMessages = [];
  const pageErrors = [];
  
  page.on('console', msg => {
    const msgText = msg.text();
    consoleMessages.push({ type: msg.type(), text: msgText });
    console.log(`Console [${msg.type()}]:`, msgText);
  });
  
  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('Page Error:', err.message);
  });
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`HTTP Error: ${response.status()} - ${response.url()}`);
    }
  });
  
  try {
    console.log('=== DEBUGGING HEXAGON GRID RENDERING ISSUE ===');
    console.log('Navigating to Storybook...');
    await page.goto('http://localhost:6007', { waitUntil: 'networkidle' });
    
    // Wait for Storybook to fully load
    await page.waitForTimeout(3000);
    
    console.log('\n=== CLICKING ON HEXAGON GRID ===');
    await page.locator('text=HexagonGrid').first().click();
    await page.waitForTimeout(1000);
    
    console.log('\n=== CLICKING ON CONNECTED HONEYCOMB STORY ===');
    await page.locator('text=Connected Honeycomb').first().click();
    await page.waitForTimeout(3000);
    
    // Get story arguments to verify what's being passed to the component
    console.log('\n=== ANALYZING STORY ARGS ===');
    const storyArgs = await page.evaluate(() => {
      // Try to access Storybook's story context
      const storybook = window.__STORYBOOK_STORY_STORE__ || window.__STORYBOOK_CLIENT_API__;
      return storybook ? 'Storybook context available' : 'No storybook context found';
    });
    console.log('Storybook context:', storyArgs);
    
    // Check DOM structure
    console.log('\n=== DOM STRUCTURE ANALYSIS ===');
    
    // Check if story root exists
    const storyRoot = await page.locator('#storybook-root').count();
    console.log(`Story root elements: ${storyRoot}`);
    
    if (storyRoot > 0) {
      // Get the HTML content of the story root
      const storyContent = await page.locator('#storybook-root').innerHTML().catch(() => 'Could not get innerHTML');
      console.log(`Story root HTML length: ${typeof storyContent === 'string' ? storyContent.length : 'N/A'} characters`);
      
      // Check for specific HexagonGrid elements
      const hexagonGrids = await page.locator('.hexagonGrid, [class*="hexagon"]').count();
      console.log(`HexagonGrid-related elements: ${hexagonGrids}`);
      
      // Check for individual hexagons
      const hexagonElements = await page.locator('.hexagon').count();
      console.log(`Individual hexagon elements: ${hexagonElements}`);
      
      // Check for hexagon wrappers
      const hexagonWrappers = await page.locator('.hexagonWrapper').count();
      console.log(`Hexagon wrapper elements: ${hexagonWrappers}`);
    }
    
    // Check canvas or SVG elements
    const canvasElements = await page.locator('canvas').count();
    const svgElements = await page.locator('svg').count();
    console.log(`Canvas elements: ${canvasElements}`);
    console.log(`SVG elements: ${svgElements}`);
    
    // Check if CSS is loading properly
    console.log('\n=== CSS ANALYSIS ===');
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement || document.querySelector('[data-theme]');
      if (!root) return 'No root element found';
      
      const computedStyle = getComputedStyle(root);
      return {
        bgSecondary: computedStyle.getPropertyValue('--color-bg-secondary').trim(),
        shadowCenter: computedStyle.getPropertyValue('--shadow-hexagon-center').trim(),
        transitionBase: computedStyle.getPropertyValue('--transition-base').trim(),
      };
    });
    console.log('CSS Variables:', cssVariables);
    
    // Try to inspect the actual component props
    console.log('\n=== COMPONENT PROPS ANALYSIS ===');
    const componentAnalysis = await page.evaluate(() => {
      // Look for React components in the DOM
      const hexagonGrids = document.querySelectorAll('[class*="hexagon"]');
      const gridElements = [];
      
      hexagonGrids.forEach((el, index) => {
        gridElements.push({
          index,
          className: el.className,
          style: el.style.cssText,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`),
          children: el.children.length
        });
      });
      
      return {
        totalElements: hexagonGrids.length,
        elements: gridElements.slice(0, 5) // First 5 elements for brevity
      };
    });
    console.log('Component Analysis:', JSON.stringify(componentAnalysis, null, 2));
    
    // Take comprehensive screenshots
    console.log('\n=== TAKING SCREENSHOTS ===');
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/debug-full-page.png', 
      fullPage: true 
    });
    
    // Try to screenshot just the story area if it exists
    const storyArea = page.locator('#storybook-root');
    if (await storyArea.count() > 0) {
      try {
        await storyArea.screenshot({ 
          path: '/Users/ivan/DEV_/alphanumericmango/feedback/debug-story-area.png' 
        });
      } catch (e) {
        console.log('Could not screenshot story area:', e.message);
      }
    }
    
    // Try different stories to see if the issue is specific to Connected Honeycomb
    const testStories = [
      'Single Hexagon',
      'Medium Amplitude',
      'Large Hexagons'
    ];
    
    console.log('\n=== TESTING OTHER STORIES ===');
    for (const story of testStories) {
      try {
        console.log(`Testing story: ${story}`);
        await page.locator(`text=${story}`).first().click();
        await page.waitForTimeout(2000);
        
        const elements = await page.locator('[class*="hexagon"]').count();
        console.log(`${story}: ${elements} hexagon elements found`);
        
        if (elements > 0) {
          await page.screenshot({ 
            path: `/Users/ivan/DEV_/alphanumericmango/feedback/debug-${story.toLowerCase().replace(/\s+/g, '-')}.png` 
          });
        }
      } catch (e) {
        console.log(`Could not test story ${story}:`, e.message);
      }
    }
    
    // Final summary
    console.log('\n=== DEBUGGING SUMMARY ===');
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Page errors: ${pageErrors.length}`);
    
    if (consoleMessages.length > 0) {
      console.log('Recent console messages:');
      consoleMessages.slice(-5).forEach(msg => {
        console.log(`  [${msg.type}] ${msg.text}`);
      });
    }
    
    if (pageErrors.length > 0) {
      console.log('Page errors:');
      pageErrors.forEach(error => {
        console.log(`  ${error}`);
      });
    }
    
  } catch (error) {
    console.error('\n=== FATAL ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await page.screenshot({ path: '/Users/ivan/DEV_/alphanumericmango/feedback/debug-fatal-error.png' });
  } finally {
    await browser.close();
    console.log('\n=== DEBUG SESSION COMPLETE ===');
  }
})();