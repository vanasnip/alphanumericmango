import { test, expect } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';

test.describe('Theme Persistence Tests', () => {
	let consoleMessages: ConsoleMessage[] = [];
	let consoleErrors: ConsoleMessage[] = [];

	test.beforeEach(async ({ page }) => {
		// Clear console messages array for each test
		consoleMessages = [];
		consoleErrors = [];
		
		// Set up console message listeners
		page.on('console', (msg) => {
			consoleMessages.push(msg);
			if (msg.type() === 'error') {
				consoleErrors.push(msg);
			}
		});

		// Clear localStorage before each test
		await page.goto('http://localhost:5174');
		await page.evaluate(() => localStorage.clear());
	});

	test('should navigate to the app successfully', async ({ page }) => {
		// Navigate to the app
		const response = await page.goto('http://localhost:5174');
		
		// Verify successful navigation
		expect(response?.status()).toBe(200);
		
		// Wait for the app to load
		await page.waitForLoadState('networkidle');
		
		// Verify basic page structure is loaded
		await expect(page).toHaveTitle(/Voice Terminal/);
	});

	test('should not have any 403 errors in console', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		
		// Wait a bit to ensure all network requests are complete
		await page.waitForTimeout(2000);
		
		// Check for 403 errors specifically
		const http403Errors = consoleMessages.filter(msg => 
			msg.text().includes('403') || msg.text().includes('Forbidden')
		);
		
		// Log all console messages for debugging
		console.log('Console messages:', consoleMessages.map(msg => 
			`[${msg.type()}] ${msg.text()}`
		));
		
		expect(http403Errors).toHaveLength(0);
	});

	test('should save theme data in localStorage', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		
		// Wait for the app to initialize
		await page.waitForTimeout(1000);
		
		// Check if there's a theme selector or if Ocean theme is already set
		const localStorage = await page.evaluate(() => {
			return {
				theme: localStorage.getItem('theme'),
				allItems: Object.keys(localStorage).reduce((acc, key) => {
					acc[key] = localStorage.getItem(key);
					return acc;
				}, {} as Record<string, string | null>)
			};
		});
		
		console.log('LocalStorage contents:', localStorage);
		
		// If no theme is set, try to set Ocean theme
		if (!localStorage.theme) {
			// Look for theme selector button or similar
			try {
				const themeButton = page.locator('[data-testid="theme-selector"], button:has-text("Ocean"), .theme-ocean, #theme-ocean');
				if (await themeButton.count() > 0) {
					await themeButton.first().click();
					await page.waitForTimeout(500);
				}
			} catch (e) {
				console.log('No theme selector found, checking if theme is set programmatically');
			}
		}
		
		// Check localStorage after potential theme change
		const updatedLocalStorage = await page.evaluate(() => 
			localStorage.getItem('voice-terminal-theme')
		);
		
		// We expect either a theme to be saved or the default to be applied
		console.log('Theme in localStorage:', updatedLocalStorage);
		
		// The test passes if there's any theme-related data
		const hasThemeData = updatedLocalStorage !== null;
		expect(hasThemeData).toBeTruthy();
	});

	test('should persist Ocean theme after page reload', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		
		// Set Ocean theme using the correct localStorage key from the theme system
		await page.evaluate(() => {
			const oceanTheme = {
				mode: 'dark',
				preset: 'ocean',
				global: {
					colors: {
						primary: '#0EA5E9',
						secondary: '#06B6D4',
						success: '#14B8A6',
						warning: '#F59E0B',
						error: '#F97316',
						background: '#0C1B1F',
						surface: '#164E63',
						text: '#F0F9FF'
					}
				}
			};
			localStorage.setItem('voice-terminal-theme', JSON.stringify(oceanTheme));
		});
		
		// Reload the page
		await page.reload();
		await page.waitForLoadState('networkidle');
		
		// Check if theme persisted in localStorage
		const persistedTheme = await page.evaluate(() => {
			const stored = localStorage.getItem('voice-terminal-theme');
			return stored ? JSON.parse(stored) : null;
		});
		
		expect(persistedTheme?.preset).toBe('ocean');
		expect(persistedTheme?.mode).toBe('dark');
		
		// Verify Ocean theme is visually applied through CSS variables and document classes
		const themeApplication = await page.evaluate(() => {
			// Check document classes
			const htmlClasses = document.documentElement.className;
			
			// Check CSS variables
			const rootStyles = getComputedStyle(document.documentElement);
			const primaryColor = rootStyles.getPropertyValue('--theme-colors-primary').trim();
			const backgroundColor = rootStyles.getPropertyValue('--theme-colors-background').trim();
			const presetVar = rootStyles.getPropertyValue('--theme-preset').trim();
			
			// Check for theme-related style elements
			const themeVariablesStyle = document.getElementById('theme-variables');
			const flowbiteVariablesStyle = document.getElementById('flowbite-variables');
			
			return {
				htmlClasses,
				primaryColor,
				backgroundColor, 
				presetVar,
				hasThemeVariables: !!themeVariablesStyle,
				hasFlowbiteVariables: !!flowbiteVariablesStyle,
				themeVariablesContent: themeVariablesStyle?.textContent?.substring(0, 200) + '...',
				flowbiteVariablesContent: flowbiteVariablesStyle?.textContent?.substring(0, 200) + '...'
			};
		});
		
		console.log('Theme application details:', themeApplication);
		
		// Verify theme mode class is applied
		expect(themeApplication.htmlClasses).toContain('theme-dark');
		
		// Verify ocean theme colors are applied as CSS variables
		expect(themeApplication.primaryColor).toBe('#0EA5E9');
		expect(themeApplication.backgroundColor).toBe('#0C1B1F');
		expect(themeApplication.presetVar).toBe('ocean');
		
		// Verify theme CSS is injected
		expect(themeApplication.hasThemeVariables).toBeTruthy();
		expect(themeApplication.hasFlowbiteVariables).toBeTruthy();
	});

	test('should not produce new errors after theme changes', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		
		// Clear any initial errors
		consoleErrors = [];
		
		// Set theme in localStorage
		await page.evaluate(() => {
			localStorage.setItem('theme', 'ocean');
		});
		
		// Reload to test persistence
		await page.reload();
		await page.waitForLoadState('networkidle');
		
		// Wait for any delayed operations
		await page.waitForTimeout(2000);
		
		// Check for new errors
		const newErrors = consoleErrors.filter(msg => 
			!msg.text().includes('DevTools') && // Ignore DevTools-specific messages
			!msg.text().includes('Extension') && // Ignore browser extension messages
			msg.type() === 'error'
		);
		
		if (newErrors.length > 0) {
			console.log('New console errors found:', newErrors.map(err => err.text()));
		}
		
		expect(newErrors).toHaveLength(0);
	});

	test('comprehensive theme persistence check', async ({ page }) => {
		// Step 1: Navigate to app
		console.log('Step 1: Navigating to app...');
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		
		// Step 2: Check for 403 errors
		console.log('Step 2: Checking for 403 errors...');
		const http403Errors = consoleMessages.filter(msg => 
			msg.text().includes('403') || msg.text().includes('Forbidden')
		);
		
		// Step 3: Check localStorage for theme data
		console.log('Step 3: Checking localStorage...');
		const initialLocalStorage = await page.evaluate(() => ({
			theme: localStorage.getItem('voice-terminal-theme'),
			allKeys: Object.keys(localStorage)
		}));
		
		// Step 4: Set Ocean theme and reload
		console.log('Step 4: Setting Ocean theme and reloading...');
		await page.evaluate(() => {
			const oceanTheme = {
				mode: 'dark',
				preset: 'ocean',
				global: {
					colors: {
						primary: '#0EA5E9',
						secondary: '#06B6D4',
						success: '#14B8A6',
						warning: '#F59E0B',
						error: '#F97316',
						background: '#0C1B1F',
						surface: '#164E63',
						text: '#F0F9FF'
					}
				}
			};
			localStorage.setItem('voice-terminal-theme', JSON.stringify(oceanTheme));
		});
		
		await page.reload();
		await page.waitForLoadState('networkidle');
		
		// Step 5: Verify theme persisted
		console.log('Step 5: Verifying theme persistence...');
		const persistedTheme = await page.evaluate(() => {
			const stored = localStorage.getItem('voice-terminal-theme');
			return stored ? JSON.parse(stored).preset : null;
		});
		
		// Step 6: Check for any new errors
		console.log('Step 6: Checking for new errors...');
		const allErrors = consoleErrors.filter(msg => 
			!msg.text().includes('DevTools') &&
			!msg.text().includes('Extension')
		);
		
		// Step 7: Check if Ocean theme is visually applied
		console.log('Step 7: Checking visual theme application...');
		const themeApplied = await page.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			
			return {
				htmlClasses: html.className,
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				presetVar: rootStyles.getPropertyValue('--theme-preset').trim(),
				hasThemeVariables: !!document.getElementById('theme-variables'),
				hasFlowbiteVariables: !!document.getElementById('flowbite-variables')
			};
		});
		
		// Generate comprehensive report
		const report = {
			navigation: 'SUCCESS',
			http403Errors: http403Errors.length,
			localStorageTheme: persistedTheme,
			themePersisted: persistedTheme === 'ocean',
			newErrors: allErrors.length,
			themeVisuallyApplied: themeApplied.presetVar === 'ocean' && 
				                 themeApplied.primaryColor === '#0EA5E9',
			themeApplication: themeApplied
		};
		
		console.log('=== COMPREHENSIVE THEME PERSISTENCE TEST REPORT ===');
		console.log(JSON.stringify(report, null, 2));
		
		// Assertions
		expect(http403Errors).toHaveLength(0);
		expect(persistedTheme).toBe('ocean');
		expect(allErrors).toHaveLength(0);
		expect(themeApplied.presetVar).toBe('ocean');
		expect(themeApplied.primaryColor).toBe('#0EA5E9');
	});
});