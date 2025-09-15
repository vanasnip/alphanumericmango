import { test, expect } from '@playwright/test';

test.describe('Theme Performance Tests @performance', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
	});

	test('theme switch performance under 100ms', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		const measurements: number[] = [];

		for (const theme of themes) {
			// Measure theme switch performance
			const duration = await page.evaluate(async (themeName) => {
				const themeStore = (window as any).__themeStore;
				if (!themeStore) throw new Error('ThemeStore not available');

				const start = performance.now();
				themeStore.setPreset(themeName);
				
				// Wait for theme application to complete
				await new Promise(resolve => {
					const checkComplete = () => {
						const computedStyle = getComputedStyle(document.documentElement);
						const primaryColor = computedStyle.getPropertyValue('--theme-primary');
						if (primaryColor) {
							resolve(undefined);
						} else {
							requestAnimationFrame(checkComplete);
						}
					};
					checkComplete();
				});

				const end = performance.now();
				return end - start;
			}, theme);

			measurements.push(duration);
			expect(duration).toBeLessThan(100); // Target < 100ms
		}

		// Log average performance
		const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
		console.log(`Average theme switch time: ${average.toFixed(2)}ms`);
		expect(average).toBeLessThan(75); // Average should be well under target
	});

	test('rapid theme switching stress test', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		const switchCount = 50;
		const measurements: number[] = [];

		const startTime = await page.evaluate(async (data) => {
			const { themes: themeList, count } = data;
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			const start = performance.now();
			
			for (let i = 0; i < count; i++) {
				const theme = themeList[i % themeList.length];
				themeStore.setPreset(theme);
				
				// Small delay to prevent overwhelming the browser
				await new Promise(resolve => setTimeout(resolve, 1));
			}

			const end = performance.now();
			return end - start;
		}, { themes, count: switchCount });

		const averagePerSwitch = startTime / switchCount;
		console.log(`Rapid switching: ${averagePerSwitch.toFixed(2)}ms per switch`);
		
		expect(averagePerSwitch).toBeLessThan(20); // Should be very fast for rapid switches
		expect(startTime).toBeLessThan(5000); // Total time should be reasonable
	});

	test('memory usage during theme operations', async ({ page }) => {
		// Get initial memory usage
		const initialMemory = await page.evaluate(() => {
			if ('memory' in performance) {
				return (performance as any).memory.usedJSHeapSize;
			}
			return 0;
		});

		// Perform many theme operations
		await page.evaluate(async () => {
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			const themes = ['default', 'ocean', 'forest'];
			
			// Switch themes many times
			for (let i = 0; i < 100; i++) {
				const theme = themes[i % themes.length];
				themeStore.setPreset(theme);
				await new Promise(resolve => setTimeout(resolve, 1));
			}

			// Force garbage collection if available
			if (window.gc) {
				window.gc();
			}
		});

		// Get final memory usage
		const finalMemory = await page.evaluate(() => {
			if ('memory' in performance) {
				return (performance as any).memory.usedJSHeapSize;
			}
			return 0;
		});

		if (initialMemory > 0 && finalMemory > 0) {
			const memoryIncrease = finalMemory - initialMemory;
			const percentIncrease = (memoryIncrease / initialMemory) * 100;
			
			console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${percentIncrease.toFixed(1)}%)`);
			
			// Memory increase should be minimal
			expect(percentIncrease).toBeLessThan(10); // Less than 10% increase
		}
	});

	test('large theme file loading performance', async ({ page }) => {
		// Create a large theme configuration
		const largeTheme = await page.evaluate(() => {
			const baseTheme = {
				theme: {
					mode: 'dark',
					preset: 'custom',
					global: {
						colors: {},
						typography: {
							fontFamily: 'system-ui',
							fontSize: { base: '16px', scale: 1.25 }
						},
						spacing: {
							unit: '0.25rem',
							scale: Array.from({ length: 100 }, (_, i) => i + 1)
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

			// Add many colors
			for (let i = 0; i < 1000; i++) {
				baseTheme.theme.global.colors[`color${i}`] = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
			}

			// Add many components
			for (let i = 0; i < 100; i++) {
				baseTheme.theme.components[`component${i}`] = {
					inherit: true,
					overrides: {
						color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
						background: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
					}
				};
			}

			return baseTheme;
		});

		// Measure loading performance
		const loadTime = await page.evaluate(async (theme) => {
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			const start = performance.now();
			themeStore.setTheme(theme);
			const end = performance.now();

			return end - start;
		}, largeTheme);

		console.log(`Large theme loading time: ${loadTime.toFixed(2)}ms`);
		expect(loadTime).toBeLessThan(500); // Should handle large themes reasonably well
	});

	test('CSS variable generation performance', async ({ page }) => {
		const measureCSSGeneration = async (themeSize: 'small' | 'medium' | 'large') => {
			return await page.evaluate(async (size) => {
				const themeStore = (window as any).__themeStore;
				if (!themeStore) throw new Error('ThemeStore not available');

				let colorCount: number;
				switch (size) {
					case 'small': colorCount = 10; break;
					case 'medium': colorCount = 100; break;
					case 'large': colorCount = 1000; break;
				}

				const theme = {
					theme: {
						mode: 'dark',
						preset: 'custom',
						global: {
							colors: {},
							typography: {
								fontFamily: 'system-ui',
								fontSize: { base: '16px', scale: 1.25 }
							},
							spacing: {
								unit: '0.25rem',
								scale: [1, 2, 3, 4]
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

				// Generate colors
				for (let i = 0; i < colorCount; i++) {
					theme.theme.global.colors[`color${i}`] = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
				}

				const start = performance.now();
				themeStore.setTheme(theme);
				
				// Wait for CSS variables to be applied
				await new Promise(resolve => setTimeout(resolve, 10));
				
				const end = performance.now();
				return end - start;
			}, themeSize);
		};

		const smallTime = await measureCSSGeneration('small');
		const mediumTime = await measureCSSGeneration('medium');
		const largeTime = await measureCSSGeneration('large');

		console.log(`CSS generation times - Small: ${smallTime.toFixed(2)}ms, Medium: ${mediumTime.toFixed(2)}ms, Large: ${largeTime.toFixed(2)}ms`);

		expect(smallTime).toBeLessThan(50);
		expect(mediumTime).toBeLessThan(150);
		expect(largeTime).toBeLessThan(500);
	});

	test('theme validation performance', async ({ page }) => {
		const validationTimes = await page.evaluate(() => {
			const times: number[] = [];
			const validator = (window as any).__themeValidator;
			if (!validator) throw new Error('ThemeValidator not available');

			const testTheme = {
				theme: {
					mode: 'dark',
					preset: 'default',
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
							fontFamily: 'system-ui',
							fontSize: { base: '16px', scale: 1.25 }
						},
						spacing: {
							unit: '0.25rem',
							scale: [1, 2, 3, 4]
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

			// Run validation 100 times
			for (let i = 0; i < 100; i++) {
				const start = performance.now();
				validator.validate(testTheme);
				const end = performance.now();
				times.push(end - start);
			}

			return times;
		});

		const averageTime = validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length;
		const maxTime = Math.max(...validationTimes);

		console.log(`Validation performance - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

		expect(averageTime).toBeLessThan(10); // Target < 10ms average
		expect(maxTime).toBeLessThan(25); // Max should be reasonable
	});

	test('file watch overhead simulation', async ({ page }) => {
		// Simulate file watching overhead
		const watcherPerformance = await page.evaluate(async () => {
			const measurements: number[] = [];
			
			// Simulate file change events
			for (let i = 0; i < 50; i++) {
				const start = performance.now();
				
				// Simulate file change detection and theme reload
				window.dispatchEvent(new StorageEvent('storage', {
					key: 'voice-terminal-theme',
					newValue: JSON.stringify({
						theme: {
							mode: i % 2 === 0 ? 'dark' : 'light',
							preset: 'default'
						}
					})
				}));
				
				// Wait for event processing
				await new Promise(resolve => setTimeout(resolve, 1));
				
				const end = performance.now();
				measurements.push(end - start);
			}

			return measurements;
		});

		const averageOverhead = watcherPerformance.reduce((a, b) => a + b, 0) / watcherPerformance.length;
		const maxOverhead = Math.max(...watcherPerformance);

		console.log(`File watch overhead - Average: ${averageOverhead.toFixed(2)}ms, Max: ${maxOverhead.toFixed(2)}ms`);

		expect(averageOverhead).toBeLessThan(5); // Very low overhead
		expect(maxOverhead).toBeLessThan(20); // Even peaks should be low
	});

	test('component re-render performance', async ({ page }) => {
		// Test how quickly components re-render when theme changes
		const rerenderTime = await page.evaluate(async () => {
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			// Create observer to measure when components finish updating
			let renderComplete = false;
			const observer = new MutationObserver(() => {
				// Check if theme has been applied by looking for CSS variable changes
				const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-primary');
				if (primaryColor.includes('82F6')) { // Ocean theme primary color
					renderComplete = true;
				}
			});

			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['style']
			});

			const start = performance.now();
			themeStore.setPreset('ocean');

			// Wait for render completion
			while (!renderComplete) {
				await new Promise(resolve => setTimeout(resolve, 1));
			}

			observer.disconnect();
			const end = performance.now();
			return end - start;
		});

		console.log(`Component re-render time: ${rerenderTime.toFixed(2)}ms`);
		expect(rerenderTime).toBeLessThan(50); // Components should update quickly
	});

	test('batch theme operations performance', async ({ page }) => {
		// Test performance when multiple theme operations happen simultaneously
		const batchPerformance = await page.evaluate(async () => {
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			const start = performance.now();

			// Perform multiple theme operations in quick succession
			const operations = [
				() => themeStore.setMode('light'),
				() => themeStore.setPreset('ocean'),
				() => themeStore.setTheme({
					theme: {
						global: {
							colors: {
								primary: '#FF6B35'
							}
						}
					}
				}),
				() => themeStore.setMode('dark'),
				() => themeStore.setPreset('forest')
			];

			// Execute all operations
			operations.forEach(op => op());

			// Wait for all operations to complete
			await new Promise(resolve => setTimeout(resolve, 100));

			const end = performance.now();
			return end - start;
		});

		console.log(`Batch operations time: ${batchPerformance.toFixed(2)}ms`);
		expect(batchPerformance).toBeLessThan(200); // Batch operations should be efficient
	});
});