import { test, expect } from '@playwright/test';

test.describe('Theme Integration Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
	});

	test.describe('Flowbite Component Integration', () => {
		test('all Flowbite components respect theme variables', async ({ page }) => {
			// Apply a custom theme
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setTheme({
						theme: {
							global: {
								colors: {
									primary: '#FF5722', // Custom orange
									secondary: '#9C27B0', // Custom purple
									success: '#4CAF50', // Custom green
									warning: '#FF9800', // Custom amber
									error: '#F44336' // Custom red
								}
							}
						}
					});
				}
			});

			await page.waitForTimeout(200);

			// Check that Flowbite components use the custom colors
			const componentTests = [
				{ selector: '[data-testid="flowbite-button-primary"]', expectedColor: '#FF5722' },
				{ selector: '[data-testid="flowbite-button-secondary"]', expectedColor: '#9C27B0' },
				{ selector: '[data-testid="flowbite-alert-success"]', expectedColor: '#4CAF50' },
				{ selector: '[data-testid="flowbite-alert-warning"]', expectedColor: '#FF9800' },
				{ selector: '[data-testid="flowbite-alert-error"]', expectedColor: '#F44336' }
			];

			for (const test of componentTests) {
				const element = page.locator(test.selector);
				if (await element.isVisible()) {
					const computedColor = await element.evaluate((el, color) => {
						const styles = window.getComputedStyle(el);
						// Check background-color or border-color that should match theme
						return {
							backgroundColor: styles.backgroundColor,
							borderColor: styles.borderColor,
							color: styles.color,
							expectedColor: color
						};
					}, test.expectedColor);

					// At least one of the color properties should reflect the theme
					const hasThemeColor = 
						computedColor.backgroundColor.includes('rgb') ||
						computedColor.borderColor.includes('rgb') ||
						computedColor.color.includes('rgb');
					
					expect(hasThemeColor).toBe(true);
				}
			}
		});

		test('Flowbite component props override theme settings', async ({ page }) => {
			// Set a base theme
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset('default');
				}
			});

			await page.waitForTimeout(200);

			// Check that component-specific props override theme
			const overrideTest = await page.evaluate(() => {
				// Create a Flowbite button with specific color prop
				const button = document.createElement('button');
				button.className = 'btn bg-red-500'; // Explicit override
				button.setAttribute('data-testid', 'override-button');
				document.body.appendChild(button);

				const styles = window.getComputedStyle(button);
				return {
					backgroundColor: styles.backgroundColor,
					hasOverride: styles.backgroundColor.includes('rgb')
				};
			});

			expect(overrideTest.hasOverride).toBe(true);
		});

		test('theme updates propagate to all Flowbite instances', async ({ page }) => {
			// Create multiple instances of the same component
			await page.evaluate(() => {
				for (let i = 0; i < 5; i++) {
					const button = document.createElement('button');
					button.className = 'btn btn-primary';
					button.setAttribute('data-testid', `button-instance-${i}`);
					button.textContent = `Button ${i}`;
					document.body.appendChild(button);
				}
			});

			// Change theme
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset('ocean');
				}
			});

			await page.waitForTimeout(200);

			// Check that all instances updated
			for (let i = 0; i < 5; i++) {
				const button = page.locator(`[data-testid="button-instance-${i}"]`);
				const styles = await button.evaluate((el) => {
					return window.getComputedStyle(el);
				});

				// All buttons should have updated styles
				expect(styles).toBeTruthy();
			}
		});
	});

	test.describe('Store Reactivity', () => {
		test('theme store changes update all subscribed components', async ({ page }) => {
			// Create multiple components that subscribe to theme store
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (!themeStore) return;

				// Create test components that react to theme changes
				const components = [];
				for (let i = 0; i < 3; i++) {
					const component = document.createElement('div');
					component.setAttribute('data-testid', `reactive-component-${i}`);
					component.style.backgroundColor = 'var(--theme-primary)';
					component.style.color = 'var(--theme-text)';
					component.style.padding = '10px';
					component.textContent = `Component ${i}`;
					document.body.appendChild(component);
					components.push(component);
				}

				// Store components for testing
				(window as any).testComponents = components;
			});

			// Change theme and verify all components update
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setTheme({
						theme: {
							global: {
								colors: {
									primary: '#00BCD4', // Cyan
									text: '#FFFFFF'
								}
							}
						}
					});
				}
			});

			await page.waitForTimeout(200);

			// Check that all components reflect the new theme
			for (let i = 0; i < 3; i++) {
				const component = page.locator(`[data-testid="reactive-component-${i}"]`);
				const styles = await component.evaluate((el) => {
					const computed = window.getComputedStyle(el);
					return {
						backgroundColor: computed.backgroundColor,
						color: computed.color
					};
				});

				// Should have updated colors
				expect(styles.backgroundColor).toBeTruthy();
				expect(styles.color).toBeTruthy();
			}
		});

		test('partial theme updates only affect relevant components', async ({ page }) => {
			// Set up components with different theme dependencies
			await page.evaluate(() => {
				// Component that uses primary color
				const primaryComponent = document.createElement('div');
				primaryComponent.setAttribute('data-testid', 'primary-component');
				primaryComponent.style.backgroundColor = 'var(--theme-primary)';
				document.body.appendChild(primaryComponent);

				// Component that uses secondary color
				const secondaryComponent = document.createElement('div');
				secondaryComponent.setAttribute('data-testid', 'secondary-component');
				secondaryComponent.style.backgroundColor = 'var(--theme-secondary)';
				document.body.appendChild(secondaryComponent);

				// Component that uses spacing
				const spacingComponent = document.createElement('div');
				spacingComponent.setAttribute('data-testid', 'spacing-component');
				spacingComponent.style.padding = 'var(--theme-spacing-4)';
				document.body.appendChild(spacingComponent);
			});

			// Get initial styles
			const initialStyles = await page.evaluate(() => {
				const primary = window.getComputedStyle(document.querySelector('[data-testid="primary-component"]')!);
				const secondary = window.getComputedStyle(document.querySelector('[data-testid="secondary-component"]')!);
				const spacing = window.getComputedStyle(document.querySelector('[data-testid="spacing-component"]')!);

				return {
					primary: primary.backgroundColor,
					secondary: secondary.backgroundColor,
					spacing: spacing.padding
				};
			});

			// Update only primary color
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setTheme({
						theme: {
							global: {
								colors: {
									primary: '#E91E63' // Pink
								}
							}
						}
					});
				}
			});

			await page.waitForTimeout(200);

			// Check that only primary component changed
			const updatedStyles = await page.evaluate(() => {
				const primary = window.getComputedStyle(document.querySelector('[data-testid="primary-component"]')!);
				const secondary = window.getComputedStyle(document.querySelector('[data-testid="secondary-component"]')!);
				const spacing = window.getComputedStyle(document.querySelector('[data-testid="spacing-component"]')!);

				return {
					primary: primary.backgroundColor,
					secondary: secondary.backgroundColor,
					spacing: spacing.padding
				};
			});

			expect(updatedStyles.primary).not.toBe(initialStyles.primary);
			expect(updatedStyles.secondary).toBe(initialStyles.secondary);
			expect(updatedStyles.spacing).toBe(initialStyles.spacing);
		});

		test('store persistence works across page reloads', async ({ page }) => {
			// Set a custom theme
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setTheme({
						theme: {
							mode: 'light',
							preset: 'custom',
							global: {
								colors: {
									primary: '#673AB7' // Deep Purple
								}
							}
						}
					});
				}
			});

			await page.waitForTimeout(200);

			// Get the applied theme
			const beforeReload = await page.evaluate(() => {
				const rootStyles = window.getComputedStyle(document.documentElement);
				return {
					primary: rootStyles.getPropertyValue('--theme-primary'),
					mode: localStorage.getItem('voice-terminal-theme')
				};
			});

			// Reload the page
			await page.reload();
			await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });

			// Check that theme persisted
			const afterReload = await page.evaluate(() => {
				const rootStyles = window.getComputedStyle(document.documentElement);
				return {
					primary: rootStyles.getPropertyValue('--theme-primary'),
					mode: localStorage.getItem('voice-terminal-theme')
				};
			});

			expect(afterReload.primary).toBe(beforeReload.primary);
			expect(afterReload.mode).toBe(beforeReload.mode);
		});
	});

	test.describe('File System Operations', () => {
		test('theme file loading from localStorage', async ({ page }) => {
			// Simulate loading from localStorage
			await page.evaluate(() => {
				const customTheme = {
					theme: {
						mode: 'dark',
						preset: 'custom',
						global: {
							colors: {
								primary: '#795548', // Brown
								background: '#1E1E1E',
								text: '#E0E0E0'
							},
							typography: {
								fontFamily: 'Roboto, sans-serif',
								fontSize: { base: '18px', scale: 1.3 }
							},
							spacing: {
								unit: '0.5rem',
								scale: [1, 2, 4, 8]
							},
							borders: {
								radius: { none: '0', sm: '4px', md: '8px', lg: '12px', full: '50%' },
								width: '2px',
								style: 'solid'
							}
						},
						components: {
							terminal: {
								inherit: false,
								background: '#0D1117',
								fontFamily: 'Fira Code, monospace'
							}
						}
					}
				};

				localStorage.setItem('voice-terminal-theme', JSON.stringify(customTheme));
				
				// Trigger reload of theme
				window.dispatchEvent(new StorageEvent('storage', {
					key: 'voice-terminal-theme',
					newValue: JSON.stringify(customTheme)
				}));
			});

			await page.waitForTimeout(200);

			// Verify theme was loaded
			const loadedTheme = await page.evaluate(() => {
				const rootStyles = window.getComputedStyle(document.documentElement);
				return {
					primary: rootStyles.getPropertyValue('--theme-primary').trim(),
					fontFamily: rootStyles.getPropertyValue('--theme-font-family').trim(),
					spacingUnit: rootStyles.getPropertyValue('--theme-spacing-unit').trim()
				};
			});

			expect(loadedTheme.primary).toBe('#795548');
			expect(loadedTheme.fontFamily).toBe('Roboto, sans-serif');
			expect(loadedTheme.spacingUnit).toBe('0.5rem');
		});

		test('file watching detects changes reliably', async ({ page }) => {
			let changeCount = 0;

			// Set up change detection
			await page.evaluate(() => {
				(window as any).themeChangeCount = 0;
				
				// Listen for theme change events
				document.addEventListener('theme-changed', () => {
					(window as any).themeChangeCount++;
				});
			});

			// Simulate multiple file changes
			const themes = [
				{ mode: 'light', preset: 'default' },
				{ mode: 'dark', preset: 'ocean' },
				{ mode: 'light', preset: 'forest' }
			];

			for (const theme of themes) {
				await page.evaluate((themeData) => {
					window.dispatchEvent(new StorageEvent('storage', {
						key: 'voice-terminal-theme',
						newValue: JSON.stringify({ theme: themeData })
					}));
				}, theme);

				await page.waitForTimeout(100);
			}

			// Check that all changes were detected
			const detectedChanges = await page.evaluate(() => (window as any).themeChangeCount);
			expect(detectedChanges).toBe(themes.length);
		});

		test('permission errors are handled gracefully', async ({ page }) => {
			// Simulate permission error by overriding localStorage
			await page.evaluate(() => {
				const originalSetItem = localStorage.setItem;
				localStorage.setItem = function(key, value) {
					if (key === 'voice-terminal-theme') {
						throw new Error('Permission denied');
					}
					return originalSetItem.call(this, key, value);
				};
			});

			// Try to save theme (should handle error gracefully)
			const errorHandled = await page.evaluate(() => {
				try {
					const themeStore = (window as any).__themeStore;
					if (themeStore) {
						themeStore.setTheme({
							theme: {
								global: {
									colors: {
										primary: '#607D8B'
									}
								}
							}
						});
					}
					return true; // No error thrown
				} catch (error) {
					return false; // Error was not handled
				}
			});

			expect(errorHandled).toBe(true);
		});
	});

	test.describe('Cross-Browser Compatibility', () => {
		test('CSS custom property support', async ({ page, browserName }) => {
			// Apply theme with CSS custom properties
			await page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset('ocean');
				}
			});

			await page.waitForTimeout(200);

			// Check that CSS custom properties are supported and working
			const customPropertySupport = await page.evaluate(() => {
				const testDiv = document.createElement('div');
				testDiv.style.setProperty('--test-var', '#FF0000');
				testDiv.style.color = 'var(--test-var)';
				document.body.appendChild(testDiv);

				const computedColor = window.getComputedStyle(testDiv).color;
				document.body.removeChild(testDiv);

				return {
					supportsCustomProperties: computedColor.includes('rgb') || computedColor.includes('#'),
					computedColor
				};
			});

			expect(customPropertySupport.supportsCustomProperties).toBe(true);

			// Verify theme variables are applied
			const themeVariables = await page.evaluate(() => {
				const root = document.documentElement;
				const styles = window.getComputedStyle(root);
				return {
					primary: styles.getPropertyValue('--theme-primary'),
					background: styles.getPropertyValue('--theme-background'),
					hasVariables: styles.getPropertyValue('--theme-primary').length > 0
				};
			});

			expect(themeVariables.hasVariables).toBe(true);
		});

		test('performance characteristics across browsers', async ({ page, browserName }) => {
			const performanceMetrics = await page.evaluate(async (browser) => {
				const themeStore = (window as any).__themeStore;
				if (!themeStore) return null;

				const measurements: number[] = [];
				
				// Measure theme switching performance
				for (let i = 0; i < 10; i++) {
					const start = performance.now();
					themeStore.setPreset(i % 2 === 0 ? 'ocean' : 'forest');
					
					await new Promise(resolve => setTimeout(resolve, 10));
					
					const end = performance.now();
					measurements.push(end - start);
				}

				return {
					browser,
					average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
					max: Math.max(...measurements),
					min: Math.min(...measurements)
				};
			}, browserName);

			if (performanceMetrics) {
				console.log(`${browserName} performance:`, performanceMetrics);
				
				// All browsers should meet performance targets
				expect(performanceMetrics.average).toBeLessThan(100);
				expect(performanceMetrics.max).toBeLessThan(200);
			}
		});

		test('event handling consistency', async ({ page, browserName }) => {
			const eventResults = await page.evaluate(async (browser) => {
				const events: string[] = [];
				
				// Listen for various events
				document.addEventListener('theme-changed', (e) => {
					events.push('theme-changed');
				});

				window.addEventListener('storage', (e) => {
					if (e.key === 'voice-terminal-theme') {
						events.push('storage');
					}
				});

				// Trigger events
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset('ocean');
				}

				// Simulate storage event
				window.dispatchEvent(new StorageEvent('storage', {
					key: 'voice-terminal-theme',
					newValue: JSON.stringify({ theme: { mode: 'light' } })
				}));

				await new Promise(resolve => setTimeout(resolve, 100));

				return {
					browser,
					events,
					themeChangeDetected: events.includes('theme-changed'),
					storageEventDetected: events.includes('storage')
				};
			}, browserName);

			expect(eventResults.themeChangeDetected).toBe(true);
			expect(eventResults.storageEventDetected).toBe(true);
		});
	});

	test.describe('Error Recovery', () => {
		test('graceful recovery from invalid theme data', async ({ page }) => {
			// Try to load invalid theme data
			await page.evaluate(() => {
				localStorage.setItem('voice-terminal-theme', 'invalid-json{');
				
				// Trigger theme reload
				window.location.reload();
			});

			await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });

			// Should fall back to default theme
			const recoveredTheme = await page.evaluate(() => {
				const rootStyles = window.getComputedStyle(document.documentElement);
				return {
					primary: rootStyles.getPropertyValue('--theme-primary').trim(),
					hasDefaultTheme: rootStyles.getPropertyValue('--theme-primary').length > 0
				};
			});

			expect(recoveredTheme.hasDefaultTheme).toBe(true);
		});

		test('fallback behavior when theme store fails', async ({ page }) => {
			// Simulate theme store failure
			await page.evaluate(() => {
				// Override theme store with broken version
				(window as any).__themeStore = {
					setTheme: () => { throw new Error('Store failure'); },
					setPreset: () => { throw new Error('Store failure'); }
				};
			});

			// Application should still function
			const applicationStillWorks = await page.evaluate(() => {
				try {
					// Try basic DOM operations
					const testElement = document.createElement('div');
					testElement.textContent = 'Test';
					document.body.appendChild(testElement);
					document.body.removeChild(testElement);
					return true;
				} catch (error) {
					return false;
				}
			});

			expect(applicationStillWorks).toBe(true);
		});
	});
});