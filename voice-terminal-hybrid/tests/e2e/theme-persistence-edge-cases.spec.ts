import { test, expect } from '@playwright/test';

test.describe('Theme Persistence Edge Cases Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage before each test
		await page.goto('http://localhost:5174');
		await page.evaluate(() => localStorage.clear());
		await page.waitForLoadState('networkidle');
	});

	test('should handle localStorage disabled gracefully', async ({ page, context }) => {
		// Disable localStorage by overriding it
		await page.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', {
				value: {
					getItem: () => { throw new Error('localStorage is disabled'); },
					setItem: () => { throw new Error('localStorage is disabled'); },
					removeItem: () => { throw new Error('localStorage is disabled'); },
					clear: () => { throw new Error('localStorage is disabled'); }
				},
				writable: false
			});
		});

		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Check that the app doesn't crash and uses default theme
		const themeApplication = await page.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			
			return {
				htmlClasses: html.className,
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				hasThemeVariables: !!document.getElementById('theme-variables')
			};
		});

		// Should fall back to default theme without crashing
		expect(themeApplication.hasThemeVariables).toBeTruthy();
		expect(themeApplication.htmlClasses).toContain('theme-dark');
	});

	test('should handle corrupted theme data in localStorage', async ({ page }) => {
		// Set corrupted JSON in localStorage
		await page.evaluate(() => {
			localStorage.setItem('voice-terminal-theme', '{invalid json}');
		});

		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Check that the app recovers with default theme
		const themeApplication = await page.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			
			return {
				htmlClasses: html.className,
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				hasThemeVariables: !!document.getElementById('theme-variables'),
				storageCleared: localStorage.getItem('voice-terminal-theme') === null
			};
		});

		// Should clear corrupted data and use default theme
		expect(themeApplication.hasThemeVariables).toBeTruthy();
		expect(themeApplication.htmlClasses).toContain('theme-dark');
		expect(themeApplication.storageCleared).toBeTruthy();
	});

	test('should handle very large theme objects', async ({ page }) => {
		// Create a very large theme object
		const largeTheme = {
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
				spacing: { unit: '0.25rem', scale: [1,2,3,4,6,8,12,16,24,32] },
				borders: {
					radius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
					width: '1px',
					style: 'solid'
				}
			},
			components: {
				terminal: {
					inherit: false,
					background: '#000000',
					fontFamily: 'JetBrains Mono, monospace'
				},
				// Add many additional components to make it large
				...Object.fromEntries(
					Array.from({ length: 1000 }, (_, i) => [
						`component${i}`,
						{ inherit: true, overrides: { color: `#${i.toString(16).padStart(6, '0')}` }}
					])
				)
			}
		};

		const themeJson = JSON.stringify(largeTheme);
		console.log(`Testing with theme size: ${themeJson.length} characters`);

		await page.evaluate((theme) => {
			localStorage.setItem('voice-terminal-theme', theme);
		}, themeJson);

		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(3000);

		// Check that large theme is handled properly
		const themeApplication = await page.evaluate(() => {
			const stored = localStorage.getItem('voice-terminal-theme');
			const parsed = stored ? JSON.parse(stored) : null;
			
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			
			return {
				themeStored: !!stored,
				themeSize: stored?.length || 0,
				componentCount: parsed ? Object.keys(parsed.components || {}).length : 0,
				htmlClasses: html.className,
				hasThemeVariables: !!document.getElementById('theme-variables'),
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim()
			};
		});

		expect(themeApplication.themeStored).toBeTruthy();
		expect(themeApplication.componentCount).toBeGreaterThan(1000);
		expect(themeApplication.hasThemeVariables).toBeTruthy();
		expect(themeApplication.htmlClasses).toContain('theme-dark');
	});

	test('should handle rapid theme switching without errors', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');

		const themes = [
			{ preset: 'ocean', primary: '#0EA5E9', background: '#0C1B1F' },
			{ preset: 'default', primary: '#3B82F6', background: '#1F2937' },
			{ preset: 'forest', primary: '#22C55E', background: '#0F172A' },
			{ preset: 'custom', primary: '#8B5CF6', background: '#111827' }
		];

		let consoleErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		// Rapidly switch themes
		for (let i = 0; i < 3; i++) {
			for (const theme of themes) {
				await page.evaluate((themeData) => {
					const themeConfig = {
						mode: 'dark',
						preset: themeData.preset,
						global: {
							colors: {
								primary: themeData.primary,
								secondary: '#8B5CF6',
								success: '#10B981',
								warning: '#F59E0B',
								error: '#EF4444',
								background: themeData.background,
								surface: '#374151',
								text: '#F9FAFB'
							}
						}
					};
					localStorage.setItem('voice-terminal-theme', JSON.stringify(themeConfig));
					
					// Trigger storage event to simulate cross-tab update
					window.dispatchEvent(new StorageEvent('storage', {
						key: 'voice-terminal-theme',
						newValue: JSON.stringify(themeConfig),
						storageArea: localStorage
					}));
				}, theme);
				
				// Small delay between switches
				await page.waitForTimeout(100);
			}
		}

		// Wait for all changes to settle
		await page.waitForTimeout(2000);

		// Check final theme application
		const finalTheme = await page.evaluate(() => {
			const stored = localStorage.getItem('voice-terminal-theme');
			const parsed = stored ? JSON.parse(stored) : null;
			
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			
			return {
				preset: parsed?.preset,
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				hasThemeVariables: !!document.getElementById('theme-variables')
			};
		});

		// Should not have any errors from rapid switching
		const themeRelatedErrors = consoleErrors.filter(err => 
			err.includes('theme') || err.includes('localStorage') || err.includes('storage')
		);
		
		expect(themeRelatedErrors).toHaveLength(0);
		expect(finalTheme.hasThemeVariables).toBeTruthy();
		expect(finalTheme.preset).toBeDefined();
	});

	test('should work in incognito/private browsing mode', async ({ browser }) => {
		// Create an incognito context
		const incognitoContext = await browser.newContext();
		const page = await incognitoContext.newPage();

		try {
			await page.goto('http://localhost:5174');
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(2000);

			// Test that theme system works even in incognito
			const themeApplication = await page.evaluate(() => {
				// Try to set a theme
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
				
				try {
					localStorage.setItem('voice-terminal-theme', JSON.stringify(oceanTheme));
					const stored = localStorage.getItem('voice-terminal-theme');
					
					const html = document.documentElement;
					const rootStyles = getComputedStyle(html);
					
					return {
						canUseLocalStorage: !!stored,
						primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
						backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
						hasThemeVariables: !!document.getElementById('theme-variables'),
						htmlClasses: html.className
					};
				} catch (error) {
					return {
						canUseLocalStorage: false,
						error: error.message,
						hasThemeVariables: !!document.getElementById('theme-variables')
					};
				}
			});

			// Even if localStorage is restricted, the app should still work
			expect(themeApplication.hasThemeVariables).toBeTruthy();
			
			// If localStorage works in incognito, theme should be applied
			if (themeApplication.canUseLocalStorage) {
				expect(themeApplication.primaryColor).toBe('#0EA5E9');
				expect(themeApplication.backgroundColor).toBe('#0C1B1F');
			}

		} finally {
			await incognitoContext.close();
		}
	});

	test('should validate theme data integrity', async ({ page }) => {
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');

		// Test with malformed theme data
		const malformedThemes = [
			null,
			undefined,
			'',
			'invalid',
			'{}',
			'{"mode": "invalid"}',
			'{"mode": "dark", "colors": "not-an-object"}',
			'{"mode": "dark", "global": {"colors": {"primary": "invalid-color"}}}'
		];

		for (const malformedTheme of malformedThemes) {
			await page.evaluate((theme) => {
				if (theme === null) {
					localStorage.removeItem('voice-terminal-theme');
				} else if (theme === undefined) {
					// Do nothing - leave undefined
				} else {
					localStorage.setItem('voice-terminal-theme', theme);
				}
			}, malformedTheme);

			await page.reload();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(1000);

			const themeState = await page.evaluate(() => {
				const html = document.documentElement;
				const rootStyles = getComputedStyle(html);
				
				return {
					hasThemeVariables: !!document.getElementById('theme-variables'),
					htmlClasses: html.className,
					primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
					backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
					storedTheme: localStorage.getItem('voice-terminal-theme')
				};
			});

			// App should always recover to a working state
			expect(themeState.hasThemeVariables).toBeTruthy();
			expect(themeState.htmlClasses).toMatch(/theme-(dark|light)/);
		}
	});
});