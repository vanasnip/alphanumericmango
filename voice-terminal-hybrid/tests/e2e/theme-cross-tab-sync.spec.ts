import { test, expect } from '@playwright/test';

test.describe('Theme Cross-Tab Synchronization Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage before each test
		await page.goto('http://localhost:5174');
		await page.evaluate(() => localStorage.clear());
		await page.waitForLoadState('networkidle');
	});

	test('should sync theme changes across tabs', async ({ context }) => {
		// Create two tabs
		const page1 = await context.newPage();
		const page2 = await context.newPage();

		// Load the app in both tabs
		await page1.goto('http://localhost:5174');
		await page2.goto('http://localhost:5174');
		await page1.waitForLoadState('networkidle');
		await page2.waitForLoadState('networkidle');
		await page1.waitForTimeout(1000);
		await page2.waitForTimeout(1000);

		// Get initial theme state from both tabs
		const initialTheme1 = await page1.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			return {
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				preset: rootStyles.getPropertyValue('--theme-preset').trim()
			};
		});

		const initialTheme2 = await page2.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			return {
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				preset: rootStyles.getPropertyValue('--theme-preset').trim()
			};
		});

		// Both tabs should start with the same theme
		expect(initialTheme1.primaryColor).toBe(initialTheme2.primaryColor);
		expect(initialTheme1.backgroundColor).toBe(initialTheme2.backgroundColor);

		// Change theme in tab 1
		await page1.evaluate(() => {
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
						fontFamily: 'JetBrains Mono, monospace',
						fontSize: '14px',
						lineHeight: 1.5,
						padding: '1rem'
					},
					voiceIndicator: {
						inherit: true,
						overrides: {
							activeColor: '#14B8A6',
							pulseAnimation: '2s ease-in-out infinite'
						}
					}
				}
			};
			
			localStorage.setItem('voice-terminal-theme', JSON.stringify(oceanTheme));
			
			// Manually trigger storage event to ensure cross-tab sync
			window.dispatchEvent(new StorageEvent('storage', {
				key: 'voice-terminal-theme',
				newValue: JSON.stringify(oceanTheme),
				storageArea: localStorage
			}));
		});

		// Wait for synchronization
		await page1.waitForTimeout(1000);
		await page2.waitForTimeout(1000);

		// Check if theme changed in tab 1
		const updatedTheme1 = await page1.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			return {
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				preset: rootStyles.getPropertyValue('--theme-preset').trim(),
				storedTheme: localStorage.getItem('voice-terminal-theme')
			};
		});

		// Check if theme synchronized in tab 2 via storage event listener
		const syncedTheme2 = await page2.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			return {
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				preset: rootStyles.getPropertyValue('--theme-preset').trim(),
				storedTheme: localStorage.getItem('voice-terminal-theme')
			};
		});

		console.log('Tab 1 theme after change:', updatedTheme1);
		console.log('Tab 2 theme after sync:', syncedTheme2);

		// Both tabs should have Ocean theme
		expect(updatedTheme1.primaryColor).toBe('#0EA5E9');
		expect(updatedTheme1.backgroundColor).toBe('#0C1B1F');
		expect(updatedTheme1.preset).toBe('ocean');

		// Tab 2 should also have the Ocean theme (synchronized)
		expect(syncedTheme2.primaryColor).toBe('#0EA5E9');
		expect(syncedTheme2.backgroundColor).toBe('#0C1B1F');
		expect(syncedTheme2.preset).toBe('ocean');

		// Both should have the same stored theme
		expect(updatedTheme1.storedTheme).toBe(syncedTheme2.storedTheme);
		
		await page1.close();
		await page2.close();
	});

	test('should handle storage events from external changes', async ({ context }) => {
		const page = await context.newPage();
		await page.goto('http://localhost:5174');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Set up monitoring for theme changes
		let themeChangeEvents = [];
		await page.evaluate(() => {
			window.themeChangeEvents = [];
			
			// Monitor for storage events
			window.addEventListener('storage', (e) => {
				if (e.key === 'voice-terminal-theme') {
					window.themeChangeEvents.push({
						key: e.key,
						newValue: e.newValue,
						timestamp: Date.now()
					});
				}
			});
		});

		// Simulate external tab changing theme by directly manipulating localStorage
		// and firing storage event
		await page.evaluate(() => {
			const forestTheme = {
				mode: 'dark',
				preset: 'forest',
				global: {
					colors: {
						primary: '#22C55E',
						secondary: '#10B981',
						success: '#059669',
						warning: '#F59E0B',
						error: '#DC2626',
						background: '#0F172A',
						surface: '#1E293B',
						text: '#F1F5F9'
					}
				}
			};
			
			// Simulate external change
			localStorage.setItem('voice-terminal-theme', JSON.stringify(forestTheme));
			
			// Fire storage event as if from another tab
			window.dispatchEvent(new StorageEvent('storage', {
				key: 'voice-terminal-theme',
				newValue: JSON.stringify(forestTheme),
				oldValue: null,
				storageArea: localStorage
			}));
		});

		// Wait for theme synchronization
		await page.waitForTimeout(2000);

		// Check if theme was applied from external change
		const syncResult = await page.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			
			return {
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				preset: rootStyles.getPropertyValue('--theme-preset').trim(),
				eventsReceived: window.themeChangeEvents.length,
				hasThemeVariables: !!document.getElementById('theme-variables')
			};
		});

		console.log('External sync result:', syncResult);

		// Should have synchronized to the forest theme
		expect(syncResult.primaryColor).toBe('#22C55E');
		expect(syncResult.backgroundColor).toBe('#0F172A');
		expect(syncResult.preset).toBe('forest');
		expect(syncResult.hasThemeVariables).toBeTruthy();
		
		await page.close();
	});

	test('should handle concurrent theme changes from multiple tabs', async ({ context }) => {
		// Create three tabs
		const pages = await Promise.all([
			context.newPage(),
			context.newPage(),
			context.newPage()
		]);

		// Load app in all tabs
		await Promise.all(pages.map(page => page.goto('http://localhost:5174')));
		await Promise.all(pages.map(page => page.waitForLoadState('networkidle')));
		await Promise.all(pages.map(page => page.waitForTimeout(1000)));

		const themes = [
			{ preset: 'ocean', primary: '#0EA5E9', background: '#0C1B1F' },
			{ preset: 'forest', primary: '#22C55E', background: '#0F172A' },
			{ preset: 'default', primary: '#3B82F6', background: '#1F2937' }
		];

		// Rapidly change themes from different tabs
		const changePromises = pages.map((page, index) => {
			const theme = themes[index];
			return page.evaluate((themeData) => {
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
				
				// Fire storage event
				window.dispatchEvent(new StorageEvent('storage', {
					key: 'voice-terminal-theme',
					newValue: JSON.stringify(themeConfig),
					storageArea: localStorage
				}));
			}, theme);
		});

		// Execute all changes nearly simultaneously
		await Promise.all(changePromises);
		
		// Wait for all changes to settle
		await Promise.all(pages.map(page => page.waitForTimeout(2000)));

		// Check final state of all tabs
		const finalStates = await Promise.all(pages.map(page => 
			page.evaluate(() => {
				const html = document.documentElement;
				const rootStyles = getComputedStyle(html);
				const stored = localStorage.getItem('voice-terminal-theme');
				const parsed = stored ? JSON.parse(stored) : null;
				
				return {
					primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
					backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
					preset: rootStyles.getPropertyValue('--theme-preset').trim(),
					storedPreset: parsed?.preset,
					hasThemeVariables: !!document.getElementById('theme-variables')
				};
			})
		));

		console.log('Final states after concurrent changes:', finalStates);

		// All tabs should have the same final state
		const firstState = finalStates[0];
		finalStates.forEach((state, index) => {
			expect(state.primaryColor).toBe(firstState.primaryColor);
			expect(state.backgroundColor).toBe(firstState.backgroundColor);
			expect(state.preset).toBe(firstState.preset);
			expect(state.storedPreset).toBe(firstState.storedPreset);
			expect(state.hasThemeVariables).toBeTruthy();
		});

		// Clean up
		await Promise.all(pages.map(page => page.close()));
	});

	test('should maintain theme consistency after tab reload', async ({ context }) => {
		const page1 = await context.newPage();
		const page2 = await context.newPage();

		// Load apps
		await page1.goto('http://localhost:5174');
		await page2.goto('http://localhost:5174');
		await page1.waitForLoadState('networkidle');
		await page2.waitForLoadState('networkidle');

		// Set theme in tab 1
		await page1.evaluate(() => {
			const customTheme = {
				mode: 'dark',
				preset: 'custom',
				global: {
					colors: {
						primary: '#8B5CF6',
						secondary: '#A855F7',
						success: '#10B981',
						warning: '#F59E0B',
						error: '#EF4444',
						background: '#111827',
						surface: '#1F2937',
						text: '#F3F4F6'
					}
				}
			};
			
			localStorage.setItem('voice-terminal-theme', JSON.stringify(customTheme));
		});

		// Reload tab 2
		await page2.reload();
		await page2.waitForLoadState('networkidle');
		await page2.waitForTimeout(2000);

		// Check if tab 2 picked up the theme from localStorage
		const theme2 = await page2.evaluate(() => {
			const html = document.documentElement;
			const rootStyles = getComputedStyle(html);
			const stored = localStorage.getItem('voice-terminal-theme');
			const parsed = stored ? JSON.parse(stored) : null;
			
			return {
				primaryColor: rootStyles.getPropertyValue('--theme-colors-primary').trim(),
				backgroundColor: rootStyles.getPropertyValue('--theme-colors-background').trim(),
				preset: rootStyles.getPropertyValue('--theme-preset').trim(),
				storedPreset: parsed?.preset
			};
		});

		// Tab 2 should have loaded the custom theme from localStorage
		expect(theme2.primaryColor).toBe('#8B5CF6');
		expect(theme2.backgroundColor).toBe('#111827');
		expect(theme2.preset).toBe('custom');
		expect(theme2.storedPreset).toBe('custom');

		await page1.close();
		await page2.close();
	});
});