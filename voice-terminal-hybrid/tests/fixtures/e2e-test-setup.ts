import { test as base, expect } from '@playwright/test';
import { ThemeTestHelpers } from './test-helpers';
import { VoiceTestHelpers } from './voice-helpers';
import { JSONEditingHelpers } from './json-editing-helpers';
import { PageFactory } from './page-objects';

/**
 * Extended test setup with all theme testing utilities
 */

export interface ThemeTestFixtures {
	themeHelpers: ThemeTestHelpers;
	voiceHelpers: VoiceTestHelpers;
	jsonHelpers: JSONEditingHelpers;
	pageFactory: PageFactory;
}

export const test = base.extend<ThemeTestFixtures>({
	/**
	 * Theme test helpers fixture
	 */
	themeHelpers: async ({ page }, use) => {
		const helpers = new ThemeTestHelpers(page);
		await use(helpers);
	},

	/**
	 * Voice test helpers fixture
	 */
	voiceHelpers: async ({ page }, use) => {
		const helpers = new VoiceTestHelpers(page);
		await helpers.initializeVoiceMocks();
		await use(helpers);
	},

	/**
	 * JSON editing helpers fixture
	 */
	jsonHelpers: async ({ page }, use) => {
		const helpers = new JSONEditingHelpers(page);
		await use(helpers);
	},

	/**
	 * Page object factory fixture
	 */
	pageFactory: async ({ page }, use) => {
		const factory = new PageFactory(page);
		await use(factory);
	}
});

/**
 * Global test setup for theme testing
 */
export async function setupThemeTestEnvironment(page: any): Promise<void> {
	// Navigate to the application
	await page.goto('/');

	// Wait for application to load
	await page.waitForLoadState('networkidle');

	// Initialize theme store
	await page.waitForFunction(() => (window as any).__themeStore);

	// Set up global test data
	await page.addInitScript(() => {
		// Initialize test data storage
		(window as any).__testData = {
			themeChanges: [],
			voiceCommands: [],
			performanceMetrics: [],
			errors: []
		};

		// Override console methods to capture errors
		const originalError = console.error;
		console.error = (...args: any[]) => {
			(window as any).__testData.errors.push({
				type: 'error',
				message: args.join(' '),
				timestamp: Date.now()
			});
			originalError.apply(console, args);
		};

		const originalWarn = console.warn;
		console.warn = (...args: any[]) => {
			(window as any).__testData.errors.push({
				type: 'warning',
				message: args.join(' '),
				timestamp: Date.now()
			});
			originalWarn.apply(console, args);
		};

		// Set up performance monitoring
		if ('PerformanceObserver' in window) {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
						(window as any).__testData.performanceMetrics.push({
							name: entry.name,
							duration: entry.duration,
							startTime: entry.startTime,
							entryType: entry.entryType
						});
					}
				}
			});

			observer.observe({ entryTypes: ['measure', 'navigation'] });
		}

		// Monitor theme changes
		document.addEventListener('theme-changed', (event: any) => {
			(window as any).__testData.themeChanges.push({
				theme: event.detail.theme,
				duration: event.detail.duration,
				timestamp: Date.now()
			});
		});
	});
}

/**
 * Custom assertions for theme testing
 */
export const themeExpect = {
	/**
	 * Assert theme performance is within acceptable limits
	 */
	async toHaveAcceptablePerformance(page: any, maxDuration = 100) {
		const duration = await page.evaluate(() => {
			const metrics = (window as any).__testData?.performanceMetrics || [];
			const themeMetrics = metrics.filter((m: any) => m.name.includes('theme'));
			return themeMetrics.length > 0 ? Math.max(...themeMetrics.map((m: any) => m.duration)) : 0;
		});

		expect(duration).toBeLessThan(maxDuration);
	},

	/**
	 * Assert no console errors occurred during theme operations
	 */
	async toHaveNoConsoleErrors(page: any) {
		const errors = await page.evaluate(() => {
			return (window as any).__testData?.errors?.filter((e: any) => e.type === 'error') || [];
		});

		expect(errors).toHaveLength(0);
	},

	/**
	 * Assert theme variables are properly set
	 */
	async toHaveValidThemeVariables(page: any) {
		const variables = await page.evaluate(() => {
			const root = document.documentElement;
			const styles = window.getComputedStyle(root);
			const variables: Record<string, string> = {};

			for (let i = 0; i < styles.length; i++) {
				const property = styles[i];
				if (property.startsWith('--theme-')) {
					variables[property] = styles.getPropertyValue(property).trim();
				}
			}

			return variables;
		});

		expect(Object.keys(variables).length).toBeGreaterThan(0);
		expect(variables['--theme-primary']).toBeTruthy();
		expect(variables['--theme-background']).toBeTruthy();
		expect(variables['--theme-text']).toBeTruthy();
	},

	/**
	 * Assert accessibility contrast ratios are met
	 */
	async toMeetAccessibilityStandards(page: any, minRatio = 4.5) {
		const contrastChecks = await page.evaluate((ratio) => {
			const checkContrast = (bgColor: string, textColor: string) => {
				// Simplified contrast calculation for testing
				const getBrightness = (color: string) => {
					const rgb = color.match(/\d+/g);
					if (!rgb || rgb.length < 3) return 0;
					return (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
				};

				const bgBrightness = getBrightness(bgColor);
				const textBrightness = getBrightness(textColor);
				const diff = Math.abs(bgBrightness - textBrightness);
				
				return diff / 255 * 21; // Approximate contrast ratio
			};

			const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, button, input, label');
			const results = [];

			for (const element of textElements) {
				const styles = window.getComputedStyle(element);
				const bgColor = styles.backgroundColor;
				const textColor = styles.color;
				
				if (bgColor !== 'rgba(0, 0, 0, 0)' && textColor) {
					const contrast = checkContrast(bgColor, textColor);
					results.push({
						element: element.tagName.toLowerCase(),
						contrast,
						passes: contrast >= ratio
					});
				}
			}

			return results;
		}, minRatio);

		const failedChecks = contrastChecks.filter(check => !check.passes);
		expect(failedChecks).toHaveLength(0);
	},

	/**
	 * Assert theme is responsive across viewports
	 */
	async toBeResponsive(page: any, viewports: Array<{ width: number; height: number }>) {
		const responsiveResults = [];

		for (const viewport of viewports) {
			await page.setViewportSize(viewport);
			await page.waitForTimeout(100);

			const isResponsive = await page.evaluate(() => {
				// Check if layout adapts to viewport
				const container = document.querySelector('main, .container, [data-testid="main-content"]');
				if (!container) return true;

				const rect = container.getBoundingClientRect();
				const viewport = { width: window.innerWidth, height: window.innerHeight };

				// Basic responsive check - content should not overflow
				return rect.width <= viewport.width && rect.right <= viewport.width;
			});

			responsiveResults.push(isResponsive);
		}

		expect(responsiveResults.every(Boolean)).toBe(true);
	}
};

/**
 * Test data generators for common scenarios
 */
export const themeTestData = {
	/**
	 * Generate test themes for various scenarios
	 */
	getTestThemes() {
		return {
			minimal: {
				theme: {
					global: {
						colors: {
							primary: '#3B82F6',
							background: '#1F2937',
							text: '#F9FAFB'
						}
					}
				}
			},
			
			complete: {
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
						}
					},
					components: {
						button: {
							inherit: true,
							overrides: {
								borderRadius: '0.375rem'
							}
						}
					}
				}
			},

			highContrast: {
				theme: {
					global: {
						colors: {
							primary: '#FFFFFF',
							secondary: '#FFFF00',
							background: '#000000',
							text: '#FFFFFF',
							error: '#FF0000',
							success: '#00FF00'
						}
					}
				}
			},

			invalid: {
				theme: {
					global: {
						colors: {
							primary: 'not-a-color',
							background: null
						}
					}
				}
			}
		};
	},

	/**
	 * Generate voice commands for testing
	 */
	getVoiceCommands() {
		return {
			themeChanges: [
				'change theme to dark',
				'switch to light mode',
				'change theme to ocean',
				'apply forest theme',
				'use default theme'
			],
			
			colorChanges: [
				'make terminal green',
				'change primary color to blue',
				'set background to black'
			],
			
			invalid: [
				'change theme to nonexistent',
				'invalid command',
				'asdfghjkl'
			],
			
			partial: [
				'change theme',
				'switch to',
				'make terminal'
			]
		};
	},

	/**
	 * Generate performance test scenarios
	 */
	getPerformanceScenarios() {
		return {
			rapidSwitching: {
				themes: ['default', 'ocean', 'forest'],
				iterations: 50,
				maxDuration: 20
			},
			
			largeTheme: {
				componentCount: 200,
				propertyCount: 50,
				maxLoadTime: 500
			},
			
			concurrentOperations: {
				operationCount: 10,
				maxTotalTime: 200
			}
		};
	},

	/**
	 * Generate accessibility test scenarios
	 */
	getAccessibilityScenarios() {
		return {
			contrastRatios: {
				minRatio: 4.5,
				elements: ['button', 'input', 'p', 'h1', 'h2', 'h3']
			},
			
			keyboardNavigation: {
				focusableElements: [
					'[data-testid="theme-settings-button"]',
					'[data-testid="voice-toggle-button"]',
					'button',
					'input',
					'select'
				]
			},
			
			screenReaderSupport: {
				ariaLabels: ['voice-toggle-button', 'theme-settings-button'],
				liveRegions: ['voice-feedback', 'theme-status'],
				landmarks: ['main', 'navigation', 'complementary']
			}
		};
	}
};

/**
 * Test utilities for cleanup and debugging
 */
export const testUtils = {
	/**
	 * Clean up test data and reset state
	 */
	async cleanup(page: any) {
		await page.evaluate(() => {
			// Clear test data
			(window as any).__testData = {
				themeChanges: [],
				voiceCommands: [],
				performanceMetrics: [],
				errors: []
			};

			// Reset theme to default
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.resetToDefault();
			}

			// Clear localStorage
			localStorage.removeItem('voice-terminal-theme');
		});
	},

	/**
	 * Capture debug information
	 */
	async captureDebugInfo(page: any) {
		return await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			const testData = (window as any).__testData;

			return {
				currentTheme: themeStore ? themeStore.getTheme() : null,
				testData: testData || {},
				url: window.location.href,
				userAgent: navigator.userAgent,
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight
				},
				timestamp: Date.now()
			};
		});
	},

	/**
	 * Wait for all animations to complete
	 */
	async waitForAnimations(page: any) {
		await page.waitForFunction(() => {
			const animations = document.getAnimations();
			return animations.every(animation => 
				animation.playState === 'finished' || 
				animation.playState === 'idle'
			);
		});
	}
};

export { expect };