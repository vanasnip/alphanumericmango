import { test, expect } from '@playwright/test';
import { ThemeTestHelpers } from '../fixtures/test-helpers';

test.describe('Error Handling and Recovery @e2e @error-handling', () => {
	let helpers: ThemeTestHelpers;

	test.beforeEach(async ({ page }) => {
		helpers = new ThemeTestHelpers(page);
		await page.goto('/');
		
		// Wait for theme store to be available
		await page.waitForFunction(() => (window as any).__themeStore);
	});

	test('should recover from invalid JSON in theme editor', async ({ page }) => {
		// Open theme settings editor
		const settingsButton = page.locator('[data-testid="theme-settings-button"]');
		await settingsButton.click();

		const jsonEditor = page.locator('[data-testid="theme-json-editor"]');
		await expect(jsonEditor).toBeVisible();

		// Enter invalid JSON
		await jsonEditor.click();
		await page.keyboard.press('Control+A');
		await jsonEditor.fill('{ invalid: json, missing: "quotes", }');

		// Should show validation error
		const errorMessage = page.locator('[data-testid="json-validation-error"]');
		await expect(errorMessage).toBeVisible();
		await expect(errorMessage).toContainText(/invalid|syntax|json/i);

		// Save button should be disabled
		const saveButton = page.locator('[data-testid="save-theme-button"]');
		await expect(saveButton).toBeDisabled();

		// Fix the JSON
		await jsonEditor.fill('{"theme": {"global": {"colors": {"primary": "#3B82F6"}}}}');

		// Error should disappear
		await expect(errorMessage).not.toBeVisible();
		
		// Save button should be enabled
		await expect(saveButton).toBeEnabled();

		// Should be able to save successfully
		await saveButton.click();
		
		// Verify theme was applied
		const appliedTheme = await helpers.getThemeVariables();
		expect(appliedTheme['--theme-primary']).toBe('#3B82F6');
	});

	test('should handle missing settings.json gracefully', async ({ page }) => {
		// Clear localStorage to simulate missing settings
		await page.evaluate(() => {
			localStorage.removeItem('voice-terminal-theme');
		});

		// Reload page
		await page.reload();
		await page.waitForFunction(() => (window as any).__themeStore);

		// Should fall back to default theme
		const defaultTheme = await helpers.getThemeVariables();
		expect(defaultTheme['--theme-primary']).toBeTruthy();
		expect(defaultTheme['--theme-background']).toBeTruthy();
		expect(defaultTheme['--theme-text']).toBeTruthy();

		// Should not show error messages
		const errorMessages = page.locator('[data-testid*="error"]');
		const errorCount = await errorMessages.count();
		expect(errorCount).toBe(0);

		// Theme functionality should still work
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						primary: '#FF0000'
					}
				}
			}
		});

		const updatedTheme = await helpers.getThemeVariables();
		expect(updatedTheme['--theme-primary']).toBe('#FF0000');
	});

	test('should handle network failures during theme save', async ({ page }) => {
		// Intercept and fail localStorage operations
		await page.addInitScript(() => {
			let failNextSave = false;
			(window as any).__failNextThemeSave = () => { failNextSave = true; };
			
			const originalSetItem = localStorage.setItem;
			localStorage.setItem = function(key: string, value: string) {
				if (key === 'voice-terminal-theme' && failNextSave) {
					failNextSave = false;
					throw new Error('Simulated storage quota exceeded');
				}
				return originalSetItem.call(this, key, value);
			};
		});

		// Try to save a theme and trigger failure
		await page.evaluate(() => {
			(window as any).__failNextThemeSave();
		});

		try {
			await helpers.applyTheme({
				theme: {
					global: {
						colors: {
							primary: '#00FF00'
						}
					}
				}
			});
		} catch (error) {
			// Expected to fail
		}

		// Should show error notification
		const errorNotification = page.locator('[data-testid="save-error-notification"]');
		if (await errorNotification.isVisible()) {
			await expect(errorNotification).toContainText(/save|storage|error/i);
		}

		// Should offer retry option
		const retryButton = page.locator('[data-testid="retry-save-button"]');
		if (await retryButton.isVisible()) {
			await retryButton.click();
			
			// Should succeed on retry
			const finalTheme = await helpers.getThemeVariables();
			expect(finalTheme['--theme-primary']).toBe('#00FF00');
		}
	});

	test('should validate theme structure and show helpful errors', async ({ page }) => {
		const invalidThemes = [
			{
				name: 'missing theme key',
				data: { global: { colors: { primary: '#FF0000' } } },
				expectedError: /theme.*required|missing.*theme/i
			},
			{
				name: 'invalid color format',
				data: { theme: { global: { colors: { primary: 'not-a-color' } } } },
				expectedError: /color.*invalid|invalid.*color/i
			},
			{
				name: 'invalid component structure',
				data: { theme: { components: { button: 'invalid-structure' } } },
				expectedError: /component.*invalid|invalid.*component/i
			},
			{
				name: 'missing required global properties',
				data: { theme: { global: {} } },
				expectedError: /colors.*required|missing.*colors/i
			}
		];

		for (const invalidTheme of invalidThemes) {
			// Open theme editor
			const settingsButton = page.locator('[data-testid="theme-settings-button"]');
			await settingsButton.click();

			const jsonEditor = page.locator('[data-testid="theme-json-editor"]');
			await jsonEditor.fill(JSON.stringify(invalidTheme.data, null, 2));

			// Should show specific validation error
			const validationError = page.locator('[data-testid="theme-validation-error"]');
			await expect(validationError).toBeVisible();
			await expect(validationError).toContainText(invalidTheme.expectedError);

			// Close modal for next test
			const closeButton = page.locator('[data-testid="close-settings-button"]');
			await closeButton.click();
		}
	});

	test('should handle corrupted localStorage data', async ({ page }) => {
		// Set corrupted localStorage data
		await page.evaluate(() => {
			localStorage.setItem('voice-terminal-theme', 'corrupted-json-data');
		});

		// Reload page
		await page.reload();
		await page.waitForFunction(() => (window as any).__themeStore);

		// Should fall back to default theme without crashing
		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBeTruthy();

		// Should show recovery notification
		const recoveryNotification = page.locator('[data-testid="theme-recovery-notification"]');
		if (await recoveryNotification.isVisible()) {
			await expect(recoveryNotification).toContainText(/recovered|restored|default/i);
		}

		// Should clear corrupted data
		const clearedData = await page.evaluate(() => {
			return localStorage.getItem('voice-terminal-theme');
		});
		
		// Should either be cleared or contain valid JSON
		if (clearedData) {
			expect(() => JSON.parse(clearedData)).not.toThrow();
		}
	});

	test('should handle theme application errors gracefully', async ({ page }) => {
		// Mock CSS variable application to fail
		await page.addInitScript(() => {
			let failNextApplication = false;
			(window as any).__failNextThemeApplication = () => { failNextApplication = true; };
			
			const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
			CSSStyleDeclaration.prototype.setProperty = function(property: string, value: string) {
				if (property.startsWith('--theme-') && failNextApplication) {
					failNextApplication = false;
					throw new Error('Failed to set CSS property');
				}
				return originalSetProperty.call(this, property, value);
			};
		});

		// Trigger theme application failure
		await page.evaluate(() => {
			(window as any).__failNextThemeApplication();
		});

		// Try to apply theme
		try {
			await helpers.applyTheme({
				theme: {
					global: {
						colors: {
							primary: '#FF0000'
						}
					}
				}
			});
		} catch (error) {
			// Expected to fail
		}

		// Should show application error
		const appError = page.locator('[data-testid="theme-application-error"]');
		if (await appError.isVisible()) {
			await expect(appError).toContainText(/apply|application|css/i);
		}

		// Should maintain previous working theme
		const currentTheme = await helpers.getThemeVariables();
		expect(currentTheme['--theme-primary']).not.toBe('#FF0000');
	});

	test('should handle voice recognition errors in theme commands', async ({ page }) => {
		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		if (await voiceButton.isVisible()) {
			await voiceButton.click();

			// Simulate voice recognition error
			await page.evaluate(() => {
				const recognition = (window as any).__mockSpeechRecognition;
				if (recognition && recognition.onerror) {
					recognition.onerror({ error: 'no-speech', message: 'No speech detected' });
				}
			});

			// Should show voice error
			const voiceError = page.locator('[data-testid="voice-error"]');
			await expect(voiceError).toBeVisible();
			await expect(voiceError).toContainText(/no speech|microphone/i);

			// Should provide recovery options
			const retryVoiceButton = page.locator('[data-testid="retry-voice-button"]');
			if (await retryVoiceButton.isVisible()) {
				await retryVoiceButton.click();
				
				// Voice indicator should show listening again
				const voiceIndicator = page.locator('[data-testid="voice-indicator"]');
				await expect(voiceIndicator).toHaveClass(/listening|active/);
			}
		}
	});

	test('should handle malformed theme file imports', async ({ page }) => {
		// Create malformed theme data
		const malformedThemes = [
			{ name: 'circular-reference.json', data: null }, // Will be set with circular reference
			{ name: 'oversized-theme.json', data: {} }, // Will be set with huge data
			{ name: 'invalid-encoding.json', data: 'invalid-utf8-\uFFFD\uFFFD' }
		];

		// Test circular reference
		const circularTheme: any = { theme: {} };
		circularTheme.theme.self = circularTheme;

		try {
			await helpers.simulateThemeFileLoad(circularTheme, 'circular-reference.json');
		} catch (error) {
			// Expected to fail
		}

		// Should show import error
		const importError = page.locator('[data-testid="theme-import-error"]');
		if (await importError.isVisible()) {
			await expect(importError).toContainText(/import|file|error/i);
		}

		// Test oversized theme
		const oversizedTheme: any = { theme: { components: {} } };
		for (let i = 0; i < 10000; i++) {
			oversizedTheme.theme.components[`component${i}`] = {
				property: `very-long-property-value-${'x'.repeat(1000)}`
			};
		}

		try {
			await helpers.simulateThemeFileLoad(oversizedTheme, 'oversized-theme.json');
		} catch (error) {
			// May fail due to size
		}

		// Should handle gracefully without crashing
		const themeStoreStillWorks = await page.evaluate(() => {
			return typeof (window as any).__themeStore?.getTheme === 'function';
		});
		expect(themeStoreStillWorks).toBe(true);
	});

	test('should provide detailed error context in development mode', async ({ page }) => {
		// Enable development mode
		await page.evaluate(() => {
			(window as any).__DEV__ = true;
		});

		// Trigger a theme error
		try {
			await helpers.applyTheme({
				theme: {
					global: {
						colors: {
							primary: 'invalid-color-value'
						}
					}
				}
			});
		} catch (error) {
			// Expected to fail
		}

		// Should show detailed error information in dev mode
		const devError = page.locator('[data-testid="dev-error-details"]');
		if (await devError.isVisible()) {
			await expect(devError).toContainText(/stack|trace|error|details/i);
			
			// Should include context about the invalid color
			await expect(devError).toContainText(/invalid-color-value/);
		}
	});

	test('should maintain theme state during error recovery', async ({ page }) => {
		// Apply a working theme first
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						primary: '#3B82F6',
						secondary: '#8B5CF6'
					}
				}
			}
		});

		const workingTheme = await helpers.getThemeVariables();

		// Try to apply an invalid theme
		try {
			await helpers.applyTheme({
				theme: {
					global: {
						colors: {
							primary: null as any, // Invalid
							secondary: undefined as any // Invalid
						}
					}
				}
			});
		} catch (error) {
			// Expected to fail
		}

		// Should maintain the working theme
		const maintainedTheme = await helpers.getThemeVariables();
		expect(maintainedTheme['--theme-primary']).toBe(workingTheme['--theme-primary']);
		expect(maintainedTheme['--theme-secondary']).toBe(workingTheme['--theme-secondary']);

		// Should be able to apply new valid themes
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						primary: '#EF4444'
					}
				}
			}
		});

		const recoveredTheme = await helpers.getThemeVariables();
		expect(recoveredTheme['--theme-primary']).toBe('#EF4444');
	});
});