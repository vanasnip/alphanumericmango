import { test, expect } from '@playwright/test';

test.describe('Storybook MessageBubble Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Storybook
    await page.goto('http://localhost:6007');
    await page.waitForLoadState('networkidle');
  });

  test('Take screenshots of MessageBubble stories', async ({ page }) => {
    // Wait for the Storybook interface to load
    await page.waitForSelector('[data-test-id="sidebar"], .sidebar, #storybook-explorer-tree', { timeout: 10000 });

    // Look for MessageBubble in the sidebar - try different selectors
    const messageBubbleSelectors = [
      'text=MessageBubble',
      '[title*="MessageBubble"]',
      '.sidebar a:has-text("MessageBubble")',
      '#storybook-explorer-tree a:has-text("MessageBubble")',
      '.tree-node:has-text("MessageBubble")'
    ];

    let messageBubbleElement = null;
    for (const selector of messageBubbleSelectors) {
      try {
        messageBubbleElement = await page.locator(selector).first();
        if (await messageBubbleElement.isVisible()) {
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (messageBubbleElement) {
      // Click on MessageBubble component
      await messageBubbleElement.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('MessageBubble component not found in sidebar, taking overall screenshot');
    }

    // Take screenshot of current state
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-initial-state.png', 
      fullPage: true 
    });

    // Try to find and click on different stories
    const stories = ['DesignSystem', 'RealisticConversation', 'ShapeComparison'];
    
    for (const story of stories) {
      try {
        const storySelectors = [
          `text=${story}`,
          `[title*="${story}"]`,
          `.sidebar a:has-text("${story}")`,
          `#storybook-explorer-tree a:has-text("${story}")`,
          `.tree-node:has-text("${story}")`
        ];

        let storyFound = false;
        for (const selector of storySelectors) {
          try {
            const storyElement = await page.locator(selector).first();
            if (await storyElement.isVisible()) {
              await storyElement.click();
              await page.waitForTimeout(2000);
              storyFound = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (storyFound) {
          // Take screenshot of the story
          await page.screenshot({ 
            path: `/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-${story.toLowerCase()}.png`, 
            fullPage: true 
          });
        } else {
          console.log(`Story ${story} not found`);
        }
      } catch (error) {
        console.error(`Error taking screenshot for ${story}:`, error);
      }
    }

    // Take a final screenshot of the main canvas area to see what's rendering
    try {
      const canvasSelectors = [
        '#storybook-preview-iframe',
        '.sb-show-main',
        '#canvas',
        '[data-test-id="canvas"]'
      ];

      for (const selector of canvasSelectors) {
        try {
          const canvas = await page.locator(selector).first();
          if (await canvas.isVisible()) {
            await canvas.screenshot({ 
              path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-canvas-area.png'
            });
            break;
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.error('Error taking canvas screenshot:', error);
    }
  });
});