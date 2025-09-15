import { test, expect } from '@playwright/test';
import { ThemeTestHelpers } from '../fixtures/test-helpers';

test.describe('Voice Control Integration @e2e @voice', () => {
	let helpers: ThemeTestHelpers;

	test.beforeEach(async ({ page }) => {
		helpers = new ThemeTestHelpers(page);
		await page.goto('/');
		
		// Wait for theme store and voice recognition to be available
		await page.waitForFunction(() => (window as any).__themeStore);
		await page.waitForFunction(() => (window as any).__voiceRecognition);
		
		// Initialize mocks for voice recognition
		await page.evaluate(() => {
			// Mock speech recognition
			(window as any).SpeechRecognition = class MockSpeechRecognition {
				continuous = true;
				interimResults = true;
				lang = 'en-US';
				onstart: (() => void) | null = null;
				onresult: ((event: any) => void) | null = null;
				onerror: ((event: any) => void) | null = null;
				onend: (() => void) | null = null;

				start() {
					if (this.onstart) this.onstart();
				}

				stop() {
					if (this.onend) this.onend();
				}

				// Helper method to simulate voice input
				simulateVoiceInput(transcript: string, confidence = 0.9) {
					if (this.onresult) {
						const mockEvent = {
							results: [{
								0: { transcript, confidence },
								isFinal: true,
								length: 1
							}],
							resultIndex: 0
						};
						this.onresult(mockEvent);
					}
				}
			};

			// Make mock available globally for tests
			(window as any).__mockSpeechRecognition = null;
		});
	});

	test('should respond to "change theme to dark" voice command', async ({ page }) => {
		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Wait for voice recognition to start
		const voiceIndicator = page.locator('[data-testid="voice-indicator"]');
		await expect(voiceIndicator).toHaveClass(/listening|active/);

		// Simulate voice command
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('change theme to dark');
			}
		});

		// Verify theme changed to dark
		await page.waitForTimeout(500);
		const themeVars = await helpers.getThemeVariables();
		
		// Check if dark mode colors are applied
		const backgroundColor = themeVars['--theme-background'];
		// Dark themes typically have dark backgrounds
		expect(backgroundColor).toMatch(/#[0-2][0-9A-Fa-f]{5}|rgb\([0-9]{1,2},\s*[0-9]{1,2},\s*[0-9]{1,2}\)/);

		// Verify voice feedback
		const feedback = page.locator('[data-testid="voice-feedback"]');
		await expect(feedback).toContainText(/theme.*dark|dark.*theme/i);
	});

	test('should respond to "change theme to light" voice command', async ({ page }) => {
		// Ensure we start from dark theme
		await helpers.setMode('dark');

		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Simulate voice command
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('change theme to light');
			}
		});

		// Verify theme changed to light
		await page.waitForTimeout(500);
		const themeVars = await helpers.getThemeVariables();
		
		const backgroundColor = themeVars['--theme-background'];
		// Light themes typically have light backgrounds
		expect(backgroundColor).toMatch(/#[E-F][0-9A-Fa-f]{5}|rgb\(2[0-5][0-9],\s*2[0-5][0-9],\s*2[0-5][0-9]\)/);
	});

	test('should respond to "make terminal green" voice command', async ({ page }) => {
		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Simulate voice command for terminal color
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('make terminal green');
			}
		});

		// Verify terminal color changed
		await page.waitForTimeout(500);
		
		// Check if terminal has green theming
		const terminal = page.locator('[data-component="terminal"]');
		if (await terminal.isVisible()) {
			const terminalStyles = await terminal.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					backgroundColor: styles.backgroundColor,
					color: styles.color,
					borderColor: styles.borderColor
				};
			});

			// At least one property should have green color values
			const hasGreen = Object.values(terminalStyles).some(value => 
				typeof value === 'string' && (
					value.includes('green') || 
					value.match(/rgb\(\s*[0-9]{1,2},\s*1[0-9]{2,3},\s*[0-9]{1,2}\)/) ||
					value.match(/#[0-9A-Fa-f]{0,2}[8-F][0-9A-Fa-f]{1,3}[0-9A-Fa-f]{0,2}/)
				)
			);
			expect(hasGreen).toBeTruthy();
		}
	});

	test('should provide voice feedback for theme changes', async ({ page }) => {
		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Simulate voice command
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('change theme to ocean');
			}
		});

		// Check for visual feedback
		const feedbackElement = page.locator('[data-testid="voice-feedback"]');
		await expect(feedbackElement).toBeVisible();
		await expect(feedbackElement).toContainText(/ocean|theme/i);

		// Check for audio feedback (if speech synthesis is available)
		const speechFeedback = await page.evaluate(() => {
			return (window as any).__lastSpokenText;
		});

		if (speechFeedback) {
			expect(speechFeedback).toMatch(/ocean|theme/i);
		}
	});

	test('should show voice indicator states correctly', async ({ page }) => {
		const voiceIndicator = page.locator('[data-testid="voice-indicator"]');
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');

		// Initial state - not listening
		await expect(voiceIndicator).not.toHaveClass(/listening|active/);

		// Start listening
		await voiceButton.click();
		await expect(voiceIndicator).toHaveClass(/listening|active/);

		// Simulate processing state
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('processing command');
			}
		});

		// Should show processing state
		await expect(voiceIndicator).toHaveClass(/processing|thinking/);

		// Stop listening
		await voiceButton.click();
		await expect(voiceIndicator).not.toHaveClass(/listening|active|processing/);
	});

	test('should handle voice recognition errors gracefully', async ({ page }) => {
		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Simulate recognition error
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition && recognition.onerror) {
				recognition.onerror({ error: 'network', message: 'Network error' });
			}
		});

		// Check error feedback
		const errorMessage = page.locator('[data-testid="voice-error"]');
		await expect(errorMessage).toBeVisible();
		await expect(errorMessage).toContainText(/error|network/i);

		// Voice indicator should return to inactive state
		const voiceIndicator = page.locator('[data-testid="voice-indicator"]');
		await expect(voiceIndicator).not.toHaveClass(/listening|active/);
	});

	test('should respond to preset theme voice commands', async ({ page }) => {
		const testCases = [
			{ command: 'change theme to ocean', preset: 'ocean' },
			{ command: 'switch to forest theme', preset: 'forest' },
			{ command: 'use default theme', preset: 'default' }
		];

		for (const testCase of testCases) {
			// Start voice recognition
			const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
			await voiceButton.click();

			// Simulate voice command
			await page.evaluate((command) => {
				const recognition = (window as any).__mockSpeechRecognition;
				if (recognition) {
					recognition.simulateVoiceInput(command);
				}
			}, testCase.command);

			// Verify correct preset was applied
			await page.waitForTimeout(500);
			const currentPreset = await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				return themeStore?.getTheme()?.theme?.preset;
			});

			expect(currentPreset).toBe(testCase.preset);

			// Stop listening before next test
			await voiceButton.click();
		}
	});

	test('should provide accessibility announcements for voice actions', async ({ page }) => {
		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Simulate voice command
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('change theme to dark');
			}
		});

		// Check for aria-live announcement
		const announcement = page.locator('[aria-live="polite"]');
		await expect(announcement).toContainText(/theme.*dark|dark.*theme/i);

		// Verify screen reader accessible feedback
		const srOnly = page.locator('.sr-only');
		if (await srOnly.isVisible()) {
			await expect(srOnly).toContainText(/theme|changed|dark/i);
		}
	});

	test('should handle continuous voice recognition sessions', async ({ page }) => {
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		
		// Start continuous session
		await voiceButton.click();

		// Execute multiple commands in sequence
		const commands = [
			'change theme to ocean',
			'make terminal green',
			'switch to light mode'
		];

		for (let i = 0; i < commands.length; i++) {
			await page.evaluate((command) => {
				const recognition = (window as any).__mockSpeechRecognition;
				if (recognition) {
					recognition.simulateVoiceInput(command);
				}
			}, commands[i]);

			// Wait for processing
			await page.waitForTimeout(300);
		}

		// Verify final state reflects all commands
		const themeVars = await helpers.getThemeVariables();
		const finalTheme = await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			return themeStore?.getTheme();
		});

		// Should have ocean preset and light mode
		expect(finalTheme?.theme?.preset).toBe('ocean');
		expect(finalTheme?.theme?.mode).toBe('light');
	});

	test('should support voice command confirmation', async ({ page }) => {
		// Enable confirmation mode if available
		const settingsButton = page.locator('[data-testid="voice-settings-button"]');
		if (await settingsButton.isVisible()) {
			await settingsButton.click();
			
			const confirmationToggle = page.locator('[data-testid="voice-confirmation-toggle"]');
			if (await confirmationToggle.isVisible()) {
				await confirmationToggle.click();
			}
		}

		// Start voice recognition
		const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
		await voiceButton.click();

		// Simulate voice command
		await page.evaluate(() => {
			const recognition = (window as any).__mockSpeechRecognition;
			if (recognition) {
				recognition.simulateVoiceInput('change theme to forest');
			}
		});

		// Check for confirmation dialog
		const confirmDialog = page.locator('[data-testid="voice-confirmation-dialog"]');
		if (await confirmDialog.isVisible()) {
			await expect(confirmDialog).toContainText(/forest|theme|confirm/i);
			
			// Confirm the action
			const confirmButton = confirmDialog.locator('[data-testid="confirm-button"]');
			await confirmButton.click();
		}

		// Verify theme was applied after confirmation
		const finalTheme = await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			return themeStore?.getTheme()?.theme?.preset;
		});

		expect(finalTheme).toBe('forest');
	});
});