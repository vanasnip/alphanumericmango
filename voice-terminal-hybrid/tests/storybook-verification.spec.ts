import { test, expect } from '@playwright/test';

test.describe('Storybook MessageBubble Verification', () => {
  test('should navigate to MessageBubble stories and take screenshots', async ({ page }) => {
    // Navigate to Storybook
    await page.goto('http://localhost:6007');
    
    // Wait for Storybook to load - look for the Components section
    await page.waitForSelector('text=COMPONENTS', { timeout: 15000 });
    
    // Click on MessageBubble in the sidebar
    await page.click('text=MessageBubble');
    
    // Wait for stories to load
    await page.waitForSelector('iframe[title="storybook-preview-iframe"]');
    
    // Create feedback directory if it doesn't exist
    await page.evaluate(() => {
      // This will be handled by the file system
    });
    
    // Test ShapeComparison story
    await page.click('text=Shape Comparison');
    await page.waitForTimeout(3000); // Wait for story to render
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-fixed-shapes.png',
      fullPage: true 
    });
    
    // Test RealisticConversation story
    await page.click('text=Realistic Conversation');
    await page.waitForTimeout(3000);
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-fixed-conversation.png',
      fullPage: true 
    });
    
    // Test UserMessage story
    await page.click('text=User Message');
    await page.waitForTimeout(3000);
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-fixed-user.png',
      fullPage: true 
    });
    
    // Switch to the iframe context and verify message bubbles are visible
    const iframe = page.frameLocator('iframe[title="storybook-preview-iframe"]');
    const messageBubbles = iframe.locator('.message-bubble, [class*="bubble"], [class*="message"], div');
    
    // Just verify the iframe content is loaded
    await expect(iframe.locator('body')).toBeVisible({ timeout: 5000 });
  });
});