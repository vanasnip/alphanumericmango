import { test, expect } from '@playwright/test';
import { themePresets } from '../../src/lib/stores/themeStore';

test.describe('Theme Preset Visual Regression', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for the app to fully load
		await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
	});

	Object.keys(themePresets).forEach(presetName => {
		test(`${presetName} theme preset renders correctly`, async ({ page }) => {
			// Apply the theme preset
			await page.evaluate((preset) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(preset);
				}
			}, presetName);

			// Wait for theme to be applied
			await page.waitForTimeout(200);

			// Take screenshot of main interface
			await expect(page).toHaveScreenshot(`theme-${presetName}-main.png`);

			// Test different component states if they exist
			const terminalElement = page.locator('[data-testid="terminal"]');
			if (await terminalElement.isVisible()) {
				await expect(terminalElement).toHaveScreenshot(`theme-${presetName}-terminal.png`);
			}

			const voiceIndicator = page.locator('[data-testid="voice-indicator"]');
			if (await voiceIndicator.isVisible()) {
				await expect(voiceIndicator).toHaveScreenshot(`theme-${presetName}-voice-indicator.png`);
			}
		});
	});

	test('dark mode variations', async ({ page }) => {
		const modes = ['dark', 'light'];
		
		for (const mode of modes) {
			await page.evaluate((themeMode) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setMode(themeMode);
				}
			}, mode);

			await page.waitForTimeout(200);
			await expect(page).toHaveScreenshot(`theme-mode-${mode}.png`);
		}
	});

	test('component state variations', async ({ page }) => {
		// Test different interactive states
		const button = page.locator('[data-testid="theme-test-button"]');
		if (await button.isVisible()) {
			// Default state
			await expect(button).toHaveScreenshot('button-default.png');

			// Hover state
			await button.hover();
			await expect(button).toHaveScreenshot('button-hover.png');

			// Focus state
			await button.focus();
			await expect(button).toHaveScreenshot('button-focus.png');
		}

		// Test form elements
		const input = page.locator('[data-testid="theme-test-input"]');
		if (await input.isVisible()) {
			await expect(input).toHaveScreenshot('input-default.png');
			
			await input.focus();
			await expect(input).toHaveScreenshot('input-focus.png');
		}
	});

	test('responsive design at different breakpoints', async ({ page }) => {
		const viewports = [
			{ width: 320, height: 568, name: 'mobile' },
			{ width: 768, height: 1024, name: 'tablet' },
			{ width: 1024, height: 768, name: 'desktop' },
			{ width: 1440, height: 900, name: 'wide' }
		];

		for (const viewport of viewports) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.waitForTimeout(100);
			
			await expect(page).toHaveScreenshot(`responsive-${viewport.name}.png`);
		}
	});

	test('theme transition animations', async ({ page }) => {
		// Start with default theme
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset('default');
			}
		});
		await page.waitForTimeout(200);

		// Capture before transition
		await expect(page).toHaveScreenshot('transition-before.png');

		// Switch to ocean theme and capture during/after transition
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset('ocean');
			}
		});

		// Capture immediately after change (may show transition)
		await page.waitForTimeout(50);
		await expect(page).toHaveScreenshot('transition-during.png');

		// Capture final state
		await page.waitForTimeout(200);
		await expect(page).toHaveScreenshot('transition-after.png');
	});

	test('high contrast mode compatibility', async ({ page }) => {
		// Simulate forced colors mode
		await page.emulateMedia({ forcedColors: 'active' });
		
		for (const preset of ['default', 'ocean', 'forest']) {
			await page.evaluate((presetName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(presetName);
				}
			}, preset);

			await page.waitForTimeout(200);
			await expect(page).toHaveScreenshot(`high-contrast-${preset}.png`);
		}
	});

	test('reduced motion preferences', async ({ page }) => {
		// Test with reduced motion
		await page.emulateMedia({ reducedMotion: 'reduce' });
		
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset('default');
			}
		});

		await page.waitForTimeout(200);
		await expect(page).toHaveScreenshot('reduced-motion.png');

		// Test theme switching with reduced motion
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset('ocean');
			}
		});

		await page.waitForTimeout(200);
		await expect(page).toHaveScreenshot('reduced-motion-switched.png');
	});
});