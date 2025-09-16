import { test, expect } from '@playwright/test';

test.describe('Direct MessageBubble Story Navigation', () => {
  const stories = [
    { name: 'shape-comparison', url: 'http://localhost:6007/?path=/story/components-messagebubble--shape-comparison' },
    { name: 'user-message', url: 'http://localhost:6007/?path=/story/components-messagebubble--user-message' },
    { name: 'design-system', url: 'http://localhost:6007/?path=/story/components-messagebubble--design-system' },
    { name: 'realistic-conversation', url: 'http://localhost:6007/?path=/story/components-messagebubble--realistic-conversation' },
    { name: 'docs', url: 'http://localhost:6007/?path=/docs/components-messagebubble--docs' }
  ];

  for (const story of stories) {
    test(`Screenshot ${story.name} story`, async ({ page }) => {
      try {
        await page.goto(story.url);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Take a screenshot
        await page.screenshot({ 
          path: `/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-${story.name}.png`, 
          fullPage: true 
        });

        // Also try to capture just the iframe content if it exists
        try {
          const iframe = page.frameLocator('#storybook-preview-iframe');
          if (iframe) {
            await iframe.locator('body').screenshot({
              path: `/Users/ivan/DEV_/alphanumericmango/feedback/storybook-messagebubble-${story.name}-content.png`
            });
          }
        } catch (e) {
          console.log('Could not capture iframe content for', story.name);
        }

      } catch (error) {
        console.error(`Error capturing ${story.name}:`, error);
      }
    });
  }
});