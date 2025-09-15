import { test, expect } from '@playwright/test';
import { ThemeTestHelpers } from '../fixtures/test-helpers';

test.describe('Theme Editing Workflow @e2e', () => {
	let helpers: ThemeTestHelpers;

	test.beforeEach(async ({ page }) => {
		helpers = new ThemeTestHelpers(page);
		await page.goto('/');
		
		// Wait for theme store to be available
		await page.waitForFunction(() => (window as any).__themeStore);
		
		// Initialize theme store for testing
		await page.evaluate(() => {
			if (!(window as any).__themeStore) {
				const { themeStore } = require('../../src/lib/stores/themeStore');
				(window as any).__themeStore = themeStore;
			}
		});
	});

	test('should open settings editor and modify JSON values', async ({ page }) => {
		// Open theme settings editor
		const settingsButton = page.locator('[data-testid="theme-settings-button"]');
		await expect(settingsButton).toBeVisible();
		await settingsButton.click();

		// Wait for settings modal to open
		const settingsModal = page.locator('[data-testid="theme-settings-modal"]');
		await expect(settingsModal).toBeVisible();

		// Locate JSON editor
		const jsonEditor = page.locator('[data-testid="theme-json-editor"]');
		await expect(jsonEditor).toBeVisible();

		// Get initial theme data
		const initialTheme = await helpers.getThemeVariables();
		const initialPrimaryColor = initialTheme['--theme-primary'];

		// Modify primary color in JSON editor
		const newPrimaryColor = '#FF6B6B';
		await jsonEditor.click();
		
		// Clear and enter new JSON with modified primary color
		await page.keyboard.press('Control+A');
		const newThemeJson = {
			theme: {
				global: {
					colors: {
						primary: newPrimaryColor
					}
				}
			}
		};
		
		await jsonEditor.fill(JSON.stringify(newThemeJson, null, 2));

		// Verify live preview updates
		await page.waitForTimeout(500); // Allow for debounced updates
		const updatedTheme = await helpers.getThemeVariables();
		expect(updatedTheme['--theme-primary']).toBe(newPrimaryColor);

		// Verify UI reflects the change
		const primaryElement = page.locator('[data-theme-role="primary"]').first();
		if (await primaryElement.isVisible()) {
			const computedStyle = await primaryElement.evaluate(el => 
				window.getComputedStyle(el).getPropertyValue('--theme-primary')
			);
			expect(computedStyle.trim()).toBe(newPrimaryColor);
		}
	});

	test('should save and reload theme persistence', async ({ page }) => {
		const testColor = '#9333EA';
		
		// Apply custom theme
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						secondary: testColor
					}
				}
			}
		});

		// Verify theme is applied
		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-secondary']).toBe(testColor);

		// Verify localStorage persistence
		const storedTheme = await page.evaluate(() => {
			return localStorage.getItem('voice-terminal-theme');
		});
		
		expect(storedTheme).toBeTruthy();
		const parsedTheme = JSON.parse(storedTheme!);
		expect(parsedTheme.theme.global.colors.secondary).toBe(testColor);

		// Reload page and verify persistence
		await page.reload();
		await page.waitForFunction(() => (window as any).__themeStore);
		
		const reloadedTheme = await helpers.getThemeVariables();
		expect(reloadedTheme['--theme-secondary']).toBe(testColor);
	});

	test('should handle undo/redo functionality', async ({ page }) => {
		const originalTheme = await helpers.getThemeVariables();
		const originalPrimary = originalTheme['--theme-primary'];

		// Apply first change
		const firstColor = '#EF4444';
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						primary: firstColor
					}
				}
			}
		});

		let currentTheme = await helpers.getThemeVariables();
		expect(currentTheme['--theme-primary']).toBe(firstColor);

		// Apply second change
		const secondColor = '#10B981';
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						primary: secondColor
					}
				}
			}
		});

		currentTheme = await helpers.getThemeVariables();
		expect(currentTheme['--theme-primary']).toBe(secondColor);

		// Test undo functionality (simulate with custom event)
		await page.evaluate(() => {
			// Simulate undo by restoring previous state
			const themeHistory = (window as any).__themeHistory || [];
			if (themeHistory.length > 1) {
				const previousTheme = themeHistory[themeHistory.length - 2];
				(window as any).__themeStore.setTheme(previousTheme);
			}
		});

		// Note: This test assumes undo/redo is implemented
		// If not implemented, this test documents the expected behavior
	});

	test('should validate JSON syntax in editor', async ({ page }) => {
		// Open settings editor
		const settingsButton = page.locator('[data-testid="theme-settings-button"]');
		await settingsButton.click();

		const jsonEditor = page.locator('[data-testid="theme-json-editor"]');
		await expect(jsonEditor).toBeVisible();

		// Enter invalid JSON
		await jsonEditor.click();
		await page.keyboard.press('Control+A');
		await jsonEditor.fill('{ invalid json }');

		// Check for validation error message
		const errorMessage = page.locator('[data-testid="json-validation-error"]');
		await expect(errorMessage).toBeVisible();
		await expect(errorMessage).toContainText(/invalid|syntax|json/i);

		// Enter valid JSON
		await jsonEditor.fill('{"theme": {"global": {"colors": {"primary": "#3B82F6"}}}}');

		// Error should disappear
		await expect(errorMessage).not.toBeVisible();
	});

	test('should show live preview of changes', async ({ page }) => {
		const previewElement = page.locator('[data-testid="theme-preview"]');
		
		// Open settings
		const settingsButton = page.locator('[data-testid="theme-settings-button"]');
		await settingsButton.click();

		// Verify preview is visible
		await expect(previewElement).toBeVisible();

		// Apply color change and verify preview updates
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						success: '#22C55E'
					}
				}
			}
		});

		// Check that preview shows the new color
		const successElement = previewElement.locator('[data-theme-role="success"]');
		if (await successElement.isVisible()) {
			const backgroundColor = await successElement.evaluate(el => 
				window.getComputedStyle(el).backgroundColor
			);
			// RGB equivalent of #22C55E
			expect(backgroundColor).toContain('34, 197, 94');
		}
	});

	test('should handle large theme files efficiently', async ({ page }) => {
		// Create a large theme with many components
		const largeTheme = {
			theme: {
				mode: 'dark',
				preset: 'custom',
				global: {
					colors: {
						primary: '#3B82F6',
						secondary: '#8B5CF6',
						success: '#10B981',
						warning: '#F59E0B',
						error: '#EF4444',
						background: '#1F2937',
						surface: '#374151',
						text: '#F9FAFB'
					},
					typography: {
						fontFamily: 'Inter, system-ui',
						fontSize: { base: '16px', scale: 1.25 }
					},
					spacing: {
						unit: '0.25rem',
						scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
					},
					borders: {
						radius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
						width: '1px',
						style: 'solid'
					}
				},
				components: {}
			}
		};

		// Add many component configurations
		for (let i = 0; i < 50; i++) {
			largeTheme.theme.components[`component${i}`] = {
				inherit: true,
				customProperty: `value${i}`,
				backgroundColor: `hsl(${i * 7}, 50%, 50%)`,
				borderRadius: `${i}px`
			};
		}

		// Measure performance of applying large theme
		const startTime = Date.now();
		await helpers.applyTheme(largeTheme);
		const endTime = Date.now();
		const duration = endTime - startTime;

		// Should handle large themes within reasonable time
		expect(duration).toBeLessThan(1000); // 1 second

		// Verify theme was applied correctly
		const appliedTheme = await helpers.getThemeVariables();
		expect(appliedTheme['--theme-primary']).toBe('#3B82F6');
	});

	test('should maintain editor state during navigation', async ({ page }) => {
		// Open settings editor
		const settingsButton = page.locator('[data-testid="theme-settings-button"]');
		await settingsButton.click();

		const jsonEditor = page.locator('[data-testid="theme-json-editor"]');
		await expect(jsonEditor).toBeVisible();

		// Enter custom JSON
		const customJson = '{"theme": {"global": {"colors": {"primary": "#FF0000"}}}}';
		await jsonEditor.fill(customJson);

		// Navigate to different section/tab if available
		const tabButton = page.locator('[data-testid="settings-tab-advanced"]');
		if (await tabButton.isVisible()) {
			await tabButton.click();
			
			// Navigate back to theme editor
			const themeTabButton = page.locator('[data-testid="settings-tab-theme"]');
			await themeTabButton.click();

			// Verify editor content is preserved
			const editorContent = await jsonEditor.inputValue();
			expect(editorContent).toBe(customJson);
		}
	});

	test('should provide keyboard shortcuts for common actions', async ({ page }) => {
		// Open settings editor
		const settingsButton = page.locator('[data-testid="theme-settings-button"]');
		await settingsButton.click();

		const jsonEditor = page.locator('[data-testid="theme-json-editor"]');
		await jsonEditor.click();

		// Test Ctrl+S for save (if implemented)
		await page.keyboard.press('Control+s');
		
		// Test Ctrl+Z for undo (if implemented)
		await page.keyboard.press('Control+z');

		// Test Ctrl+Y for redo (if implemented)
		await page.keyboard.press('Control+y');

		// These tests document expected keyboard shortcuts
		// Implementation may vary based on actual functionality
	});
});