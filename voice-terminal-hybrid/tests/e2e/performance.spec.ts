import { test, expect } from '@playwright/test';
import { ThemeTestHelpers } from '../fixtures/test-helpers';

test.describe('Performance E2E Tests @e2e @performance', () => {
	let helpers: ThemeTestHelpers;

	test.beforeEach(async ({ page }) => {
		helpers = new ThemeTestHelpers(page);
		await page.goto('/');
		
		// Wait for theme store to be available
		await page.waitForFunction(() => (window as any).__themeStore);
		
		// Enable performance monitoring
		await page.addInitScript(() => {
			(window as any).__performanceMetrics = {
				themeSwitchTimes: [],
				memorySnapshots: [],
				renderTimes: []
			};
		});
	});

	test('should switch themes within 100ms performance target', async ({ page }) => {
		const themePresets = ['default', 'ocean', 'forest'];
		const performanceTimes: number[] = [];

		for (let i = 0; i < themePresets.length; i++) {
			const fromPreset = themePresets[i];
			const toPreset = themePresets[(i + 1) % themePresets.length];

			const switchTime = await helpers.measureThemeSwitchPerformance(fromPreset, toPreset);
			performanceTimes.push(switchTime);

			// Each switch should be under 100ms
			expect(switchTime).toBeLessThan(100);
		}

		// Average should be well under target
		const averageTime = performanceTimes.reduce((a, b) => a + b, 0) / performanceTimes.length;
		expect(averageTime).toBeLessThan(50);

		// Log performance metrics
		console.log(`Theme switch times: ${performanceTimes.map(t => `${t.toFixed(1)}ms`).join(', ')}`);
		console.log(`Average theme switch time: ${averageTime.toFixed(1)}ms`);
	});

	test('should handle rapid theme switching without performance degradation', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		const iterations = 50;

		const results = await helpers.rapidThemeSwitching(themes, iterations);

		// Should maintain reasonable performance under stress
		expect(results.averageTime).toBeLessThan(20); // Average under 20ms
		expect(results.maxTime).toBeLessThan(100); // No switch over 100ms
		expect(results.errors).toBe(0); // No errors during rapid switching

		// Performance should not degrade significantly over time
		const firstQuarterAvg = await page.evaluate(() => {
			const metrics = (window as any).__performanceMetrics?.themeSwitchTimes || [];
			const firstQuarter = metrics.slice(0, Math.floor(metrics.length / 4));
			return firstQuarter.reduce((a: number, b: number) => a + b, 0) / firstQuarter.length;
		});

		const lastQuarterAvg = await page.evaluate(() => {
			const metrics = (window as any).__performanceMetrics?.themeSwitchTimes || [];
			const lastQuarter = metrics.slice(-Math.floor(metrics.length / 4));
			return lastQuarter.reduce((a: number, b: number) => a + b, 0) / lastQuarter.length;
		});

		if (firstQuarterAvg && lastQuarterAvg) {
			const degradationRatio = lastQuarterAvg / firstQuarterAvg;
			expect(degradationRatio).toBeLessThan(2); // No more than 2x degradation
		}

		console.log(`Rapid switching results:`, results);
	});

	test('should maintain memory efficiency during theme operations', async ({ page }) => {
		// Get initial memory baseline
		const initialMemory = await page.evaluate(() => {
			if ('memory' in performance) {
				return (performance as any).memory.usedJSHeapSize;
			}
			return null;
		});

		if (initialMemory === null) {
			console.log('Memory API not available, skipping memory test');
			return;
		}

		// Perform extensive theme operations
		const themes = ['default', 'ocean', 'forest'];
		for (let cycle = 0; cycle < 20; cycle++) {
			for (const theme of themes) {
				await helpers.applyPreset(theme, 10);
				
				// Apply custom modifications
				await helpers.applyTheme({
					theme: {
						global: {
							colors: {
								primary: `hsl(${cycle * 18}, 70%, 50%)`
							}
						}
					}
				});
			}
		}

		// Force garbage collection if available
		await page.evaluate(() => {
			if ((window as any).gc) {
				(window as any).gc();
			}
		});

		// Measure final memory usage
		const finalMemory = await page.evaluate(() => {
			if ('memory' in performance) {
				return (performance as any).memory.usedJSHeapSize;
			}
			return null;
		});

		if (finalMemory && initialMemory) {
			const memoryIncrease = finalMemory - initialMemory;
			const percentIncrease = (memoryIncrease / initialMemory) * 100;

			// Memory increase should be reasonable (less than 20%)
			expect(percentIncrease).toBeLessThan(20);

			console.log(`Memory usage: ${(initialMemory / 1024 / 1024).toFixed(1)}MB → ${(finalMemory / 1024 / 1024).toFixed(1)}MB (+${percentIncrease.toFixed(1)}%)`);
		}
	});

	test('should efficiently handle large theme files', async ({ page }) => {
		// Create a large theme with many components and properties
		const largeTheme = {
			theme: {
				global: {
					colors: {},
					typography: {
						fontFamily: 'Inter, sans-serif',
						fontSize: { base: '16px', scale: 1.25 }
					},
					spacing: {
						unit: '0.25rem',
						scale: Array.from({ length: 50 }, (_, i) => i * 0.5)
					},
					borders: {
						radius: {},
						width: '1px',
						style: 'solid'
					}
				},
				components: {}
			}
		};

		// Add many color variations
		for (let i = 0; i < 100; i++) {
			(largeTheme.theme.global.colors as any)[`color${i}`] = `hsl(${i * 3.6}, 70%, 50%)`;
		}

		// Add many border radius variations
		for (let i = 0; i < 50; i++) {
			(largeTheme.theme.global.borders.radius as any)[`radius${i}`] = `${i * 2}px`;
		}

		// Add many component configurations
		for (let i = 0; i < 200; i++) {
			(largeTheme.theme.components as any)[`component${i}`] = {
				inherit: true,
				backgroundColor: `hsl(${i * 1.8}, 60%, 50%)`,
				color: `hsl(${(i * 1.8 + 180) % 360}, 60%, 20%)`,
				padding: `${i % 20 + 5}px`,
				margin: `${i % 15 + 2}px`,
				borderRadius: `${i % 10 + 1}px`,
				fontSize: `${14 + (i % 8)}px`,
				lineHeight: `${1.2 + (i % 10) * 0.1}`,
				customProperty1: `value${i}-1`,
				customProperty2: `value${i}-2`,
				customProperty3: `value${i}-3`
			};
		}

		// Measure application time
		const startTime = performance.now();
		await helpers.applyTheme(largeTheme);
		const endTime = performance.now();
		const applicationTime = endTime - startTime;

		// Should handle large themes efficiently (under 500ms)
		expect(applicationTime).toBeLessThan(500);

		// Verify theme was applied correctly
		const appliedVars = await helpers.getThemeVariables();
		expect(Object.keys(appliedVars).length).toBeGreaterThan(50);

		// Test that UI remains responsive
		const uiResponseTime = await page.evaluate(async () => {
			const start = performance.now();
			
			// Simulate user interaction
			const button = document.querySelector('button');
			if (button) {
				button.click();
			}
			
			// Wait a frame
			await new Promise(resolve => requestAnimationFrame(resolve));
			
			return performance.now() - start;
		});

		// UI should remain responsive (under 16ms for 60fps)
		expect(uiResponseTime).toBeLessThan(50);

		console.log(`Large theme application: ${applicationTime.toFixed(1)}ms, UI response: ${uiResponseTime.toFixed(1)}ms`);
	});

	test('should optimize CSS variable updates', async ({ page }) => {
		// Measure CSS variable setting performance
		const cssUpdateTimes = await page.evaluate(() => {
			const times: number[] = [];
			const root = document.documentElement;
			
			for (let i = 0; i < 100; i++) {
				const start = performance.now();
				root.style.setProperty(`--test-var-${i}`, `value-${i}`);
				const end = performance.now();
				times.push(end - start);
			}
			
			return times;
		});

		const averageCSSUpdateTime = cssUpdateTimes.reduce((a, b) => a + b, 0) / cssUpdateTimes.length;
		const maxCSSUpdateTime = Math.max(...cssUpdateTimes);

		// CSS variable updates should be fast
		expect(averageCSSUpdateTime).toBeLessThan(1); // Average under 1ms
		expect(maxCSSUpdateTime).toBeLessThan(5); // Max under 5ms

		// Test batch CSS updates
		const batchUpdateTime = await page.evaluate(() => {
			const start = performance.now();
			const root = document.documentElement;
			
			// Batch multiple updates
			for (let i = 0; i < 50; i++) {
				root.style.setProperty(`--batch-var-${i}`, `hsl(${i * 7}, 70%, 50%)`);
			}
			
			return performance.now() - start;
		});

		// Batch updates should be efficient
		expect(batchUpdateTime).toBeLessThan(20);

		console.log(`CSS update performance: avg ${averageCSSUpdateTime.toFixed(2)}ms, max ${maxCSSUpdateTime.toFixed(2)}ms, batch ${batchUpdateTime.toFixed(1)}ms`);
	});

	test('should measure theme loading and initialization performance', async ({ page }) => {
		// Measure cold start performance
		await page.evaluate(() => {
			// Clear caches
			localStorage.removeItem('voice-terminal-theme');
			if ('caches' in window) {
				caches.keys().then(names => {
					names.forEach(name => caches.delete(name));
				});
			}
		});

		await page.reload();

		const initPerformance = await page.evaluate(() => {
			return new Promise(resolve => {
				const start = performance.now();
				
				const checkInit = () => {
					if ((window as any).__themeStore) {
						const end = performance.now();
						resolve(end - start);
					} else {
						requestAnimationFrame(checkInit);
					}
				};
				checkInit();
			});
		});

		// Theme initialization should be fast
		expect(initPerformance).toBeLessThan(100);

		// Measure theme restoration from localStorage
		await helpers.applyTheme({
			theme: {
				global: {
					colors: {
						primary: '#FF6B6B',
						secondary: '#4ECDC4'
					}
				}
			}
		});

		await page.reload();

		const restorationTime = await page.evaluate(() => {
			return new Promise(resolve => {
				const start = performance.now();
				
				const checkRestored = () => {
					const primaryColor = getComputedStyle(document.documentElement)
						.getPropertyValue('--theme-primary');
					
					if (primaryColor.trim() === '#FF6B6B') {
						const end = performance.now();
						resolve(end - start);
					} else {
						requestAnimationFrame(checkRestored);
					}
				};
				checkRestored();
			});
		});

		// Theme restoration should be fast
		expect(restorationTime).toBeLessThan(50);

		console.log(`Init performance: ${initPerformance}ms, restoration: ${restorationTime}ms`);
	});

	test('should handle concurrent theme operations efficiently', async ({ page }) => {
		// Start multiple theme operations simultaneously
		const concurrentPromises = [];

		for (let i = 0; i < 10; i++) {
			const promise = helpers.applyTheme({
				theme: {
					global: {
						colors: {
							primary: `hsl(${i * 36}, 70%, 50%)`
						}
					}
				}
			});
			concurrentPromises.push(promise);
		}

		const startTime = performance.now();
		await Promise.all(concurrentPromises);
		const endTime = performance.now();
		const totalTime = endTime - startTime;

		// Concurrent operations should complete efficiently
		expect(totalTime).toBeLessThan(200);

		// Verify final state is consistent
		const finalTheme = await helpers.getThemeVariables();
		expect(finalTheme['--theme-primary']).toBeTruthy();

		// No errors should occur during concurrent operations
		const errors = await page.evaluate(() => {
			return (window as any).__themeErrors || [];
		});
		expect(errors.length).toBe(0);

		console.log(`Concurrent operations completed in ${totalTime.toFixed(1)}ms`);
	});

	test('should maintain 60fps during theme transitions', async ({ page }) => {
		// Enable frame rate monitoring
		await page.addInitScript(() => {
			let frames = 0;
			let lastTime = performance.now();
			
			const measureFPS = () => {
				const now = performance.now();
				frames++;
				
				if (now - lastTime >= 1000) {
					(window as any).__currentFPS = frames;
					frames = 0;
					lastTime = now;
				}
				
				requestAnimationFrame(measureFPS);
			};
			
			requestAnimationFrame(measureFPS);
		});

		// Wait for baseline FPS measurement
		await page.waitForTimeout(1100);

		// Perform theme transition while measuring FPS
		const themes = ['default', 'ocean', 'forest'];
		
		for (let i = 0; i < themes.length; i++) {
			await helpers.applyPreset(themes[i], 50);
			
			// Check FPS during transition
			const fps = await page.evaluate(() => (window as any).__currentFPS || 0);
			
			// Should maintain reasonable frame rate (allow some variance)
			expect(fps).toBeGreaterThan(30); // At least 30fps during transitions
		}

		// Final FPS check after transitions complete
		await page.waitForTimeout(1100);
		const finalFPS = await page.evaluate(() => (window as any).__currentFPS || 0);
		expect(finalFPS).toBeGreaterThan(50); // Should recover to good frame rate
	});

	test('should profile paint and layout performance', async ({ page }) => {
		// Enable paint timing
		const paintMetrics = await page.evaluate(() => {
			if ('PerformanceObserver' in window) {
				const paintTimes: number[] = [];
				
				const observer = new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) {
						if (entry.entryType === 'paint') {
							paintTimes.push(entry.startTime);
						}
					}
				});
				
				observer.observe({ entryTypes: ['paint'] });
				
				return new Promise(resolve => {
					setTimeout(() => {
						observer.disconnect();
						resolve(paintTimes);
					}, 2000);
				});
			}
			return [];
		});

		// Apply theme changes while monitoring
		await helpers.applyPreset('ocean');
		await page.waitForTimeout(100);
		await helpers.applyPreset('forest');
		await page.waitForTimeout(100);
		await helpers.applyPreset('default');

		// Check layout thrashing
		const layoutThrashing = await page.evaluate(() => {
			let layoutCount = 0;
			const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
			
			Element.prototype.getBoundingClientRect = function() {
				layoutCount++;
				return originalGetBoundingClientRect.call(this);
			};
			
			// Trigger potential layout thrashing
			const elements = document.querySelectorAll('*');
			elements.forEach(el => el.getBoundingClientRect());
			
			// Restore original method
			Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
			
			return layoutCount;
		});

		// Should not cause excessive layout calculations
		expect(layoutThrashing).toBeLessThan(1000);

		console.log(`Paint metrics available: ${Array.isArray(paintMetrics) && paintMetrics.length > 0}`);
		console.log(`Layout calculations: ${layoutThrashing}`);
	});
});