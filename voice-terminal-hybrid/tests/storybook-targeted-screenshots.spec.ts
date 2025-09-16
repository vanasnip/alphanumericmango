import { test, expect } from '@playwright/test';

test.describe('Targeted MessageBubble Story Screenshots', () => {
  test('Take screenshots of specific MessageBubble stories', async ({ page }) => {
    // Navigate to Storybook
    await page.goto('http://localhost:6007');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Wait for the sidebar to load
    await page.waitForSelector('.sidebar', { timeout: 10000 });

    // Try to expand MessageBubble if it's collapsed
    try {
      const messageBubbleComponent = page.locator('.sidebar').locator('text=MessageBubble').first();
      await messageBubbleComponent.click();
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('MessageBubble already expanded or not found');
    }

    // Take screenshot of initial docs page
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-docs.png', 
      fullPage: true 
    });

    // Navigate to Shape Comparison story
    try {
      const shapeComparisonStory = page.locator('.sidebar').locator('text=Shape Comparison').first();
      await shapeComparisonStory.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-shapecomparison.png', 
        fullPage: true 
      });
    } catch (error) {
      console.error('Error navigating to Shape Comparison:', error);
    }

    // Navigate to User Message story
    try {
      const userMessageStory = page.locator('.sidebar').locator('text=User Message').first();
      await userMessageStory.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-usermessage.png', 
        fullPage: true 
      });
    } catch (error) {
      console.error('Error navigating to User Message:', error);
    }

    // Try direct navigation via URL if stories exist
    const storyUrls = [
      'http://localhost:6007/?path=/story/components-messagebubble--design-system',
      'http://localhost:6007/?path=/story/components-messagebubble--realistic-conversation',
      'http://localhost:6007/?path=/story/components-messagebubble--shape-comparison',
      'http://localhost:6007/?path=/story/components-messagebubble--user-message'
    ];

    for (const [index, url] of storyUrls.entries()) {
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        const storyName = url.split('--')[1];
        await page.screenshot({ 
          path: `/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-${storyName}.png`, 
          fullPage: true 
        });
      } catch (error) {
        console.error(`Error navigating to ${url}:`, error);
      }
    }
  });
});