import { Page, expect } from '@playwright/test';
import type { AppTheme } from '../../src/lib/stores/themeStore';

/**
 * Test helper utilities for theme testing
 */

export class ThemeTestHelpers {
	constructor(private page: Page) {}

	/**
	 * Apply a theme and wait for it to be fully loaded
	 */
	async applyTheme(theme: Partial<AppTheme>, waitTime = 200): Promise<void> {
		await this.page.evaluate((themeData) => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setTheme(themeData);
			}
		}, theme);

		await this.page.waitForTimeout(waitTime);
	}

	/**
	 * Apply a theme preset and wait for it to be loaded
	 */
	async applyPreset(presetName: string, waitTime = 200): Promise<void> {
		await this.page.evaluate((preset) => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset(preset);
			}
		}, presetName);

		await this.page.waitForTimeout(waitTime);
	}

	/**
	 * Get current theme CSS variables
	 */
	async getThemeVariables(): Promise<Record<string, string>> {
		return await this.page.evaluate(() => {
			const root = document.documentElement;
			const styles = window.getComputedStyle(root);
			const variables: Record<string, string> = {};

			// Get all CSS custom properties starting with --theme-
			for (let i = 0; i < styles.length; i++) {
				const property = styles[i];
				if (property.startsWith('--theme-')) {
					variables[property] = styles.getPropertyValue(property).trim();
				}
			}

			return variables;
		});
	}

	/**
	 * Measure theme switch performance
	 */
	async measureThemeSwitchPerformance(fromPreset: string, toPreset: string): Promise<number> {
		return await this.page.evaluate(async (presets) => {
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			// Apply initial theme
			themeStore.setPreset(presets.from);
			await new Promise(resolve => setTimeout(resolve, 100));

			// Measure switch time
			const start = performance.now();
			themeStore.setPreset(presets.to);
			
			// Wait for theme to be applied
			await new Promise(resolve => {
				const checkApplied = () => {
					const primaryColor = getComputedStyle(document.documentElement)
						.getPropertyValue('--theme-primary');
					if (primaryColor) {
						resolve(undefined);
					} else {
						requestAnimationFrame(checkApplied);
					}
				};
				checkApplied();
			});

			const end = performance.now();
			return end - start;
		}, { from: fromPreset, to: toPreset });
	}

	/**
	 * Check if element has proper focus indicators
	 */
	async hasFocusIndicators(selector: string): Promise<boolean> {
		const element = this.page.locator(selector);
		await element.focus();

		return await element.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return (
				styles.outline !== 'none' ||
				styles.outlineWidth !== '0px' ||
				styles.boxShadow !== 'none' ||
				styles.border !== 'none'
			);
		});
	}

	/**
	 * Calculate contrast ratio between two colors
	 */
	async calculateContrastRatio(color1: string, color2: string): Promise<number> {
		return await this.page.evaluate((colors) => {
			const hexToRgb = (hex: string) => {
				const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
				return result ? {
					r: parseInt(result[1], 16),
					g: parseInt(result[2], 16),
					b: parseInt(result[3], 16)
				} : null;
			};

			const getLuminance = (rgb: {r: number, g: number, b: number}) => {
				const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
					c = c / 255;
					return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
				});
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			};

			const rgb1 = hexToRgb(colors.color1);
			const rgb2 = hexToRgb(colors.color2);

			if (!rgb1 || !rgb2) return 1;

			const l1 = getLuminance(rgb1);
			const l2 = getLuminance(rgb2);

			const lighter = Math.max(l1, l2);
			const darker = Math.min(l1, l2);

			return (lighter + 0.05) / (darker + 0.05);
		}, { color1, color2 });
	}

	/**
	 * Get all interactive elements and their sizes
	 */
	async getInteractiveElementSizes(): Promise<Array<{tag: string, width: number, height: number}>> {
		return await this.page.evaluate(() => {
			const interactiveSelectors = [
				'button',
				'a',
				'input',
				'select',
				'textarea',
				'[role="button"]',
				'[role="link"]',
				'[tabindex]:not([tabindex="-1"])'
			];

			const elements = document.querySelectorAll(interactiveSelectors.join(', '));
			const results: Array<{tag: string, width: number, height: number}> = [];

			elements.forEach(element => {
				const rect = element.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) {
					results.push({
						tag: element.tagName.toLowerCase(),
						width: rect.width,
						height: rect.height
					});
				}
			});

			return results;
		});
	}

	/**
	 * Simulate rapid theme switching for stress testing
	 */
	async rapidThemeSwitching(themes: string[], iterations: number): Promise<{
		averageTime: number;
		maxTime: number;
		minTime: number;
		errors: number;
	}> {
		return await this.page.evaluate(async (data) => {
			const { themes, iterations } = data;
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			const times: number[] = [];
			let errors = 0;

			for (let i = 0; i < iterations; i++) {
				const theme = themes[i % themes.length];
				
				try {
					const start = performance.now();
					themeStore.setPreset(theme);
					await new Promise(resolve => setTimeout(resolve, 5));
					const end = performance.now();
					
					times.push(end - start);
				} catch (error) {
					errors++;
				}
			}

			return {
				averageTime: times.reduce((a, b) => a + b, 0) / times.length,
				maxTime: Math.max(...times),
				minTime: Math.min(...times),
				errors
			};
		}, { themes, iterations });
	}

	/**
	 * Check for memory leaks during theme operations
	 */
	async checkMemoryUsage(): Promise<{
		initialMemory: number;
		finalMemory: number;
		increase: number;
		percentIncrease: number;
	} | null> {
		return await this.page.evaluate(async () => {
			if (!('memory' in performance)) return null;

			const initialMemory = (performance as any).memory.usedJSHeapSize;

			// Perform theme operations
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				const themes = ['default', 'ocean', 'forest'];
				for (let i = 0; i < 50; i++) {
					const theme = themes[i % themes.length];
					themeStore.setPreset(theme);
					await new Promise(resolve => setTimeout(resolve, 1));
				}
			}

			// Force garbage collection if available
			if ((window as any).gc) {
				(window as any).gc();
			}

			const finalMemory = (performance as any).memory.usedJSHeapSize;
			const increase = finalMemory - initialMemory;
			const percentIncrease = (increase / initialMemory) * 100;

			return {
				initialMemory,
				finalMemory,
				increase,
				percentIncrease
			};
		});
	}

	/**
	 * Validate that all required CSS variables are set
	 */
	async validateRequiredCSSVariables(): Promise<{valid: boolean, missing: string[]}> {
		return await this.page.evaluate(() => {
			const requiredVariables = [
				'--theme-primary',
				'--theme-secondary',
				'--theme-success',
				'--theme-warning',
				'--theme-error',
				'--theme-background',
				'--theme-surface',
				'--theme-text',
				'--theme-font-family',
				'--theme-font-size',
				'--theme-spacing-unit'
			];

			const root = document.documentElement;
			const styles = window.getComputedStyle(root);
			const missing: string[] = [];

			requiredVariables.forEach(variable => {
				const value = styles.getPropertyValue(variable).trim();
				if (!value) {
					missing.push(variable);
				}
			});

			return {
				valid: missing.length === 0,
				missing
			};
		});
	}

	/**
	 * Simulate file system theme loading
	 */
	async simulateThemeFileLoad(themeData: any, filename = 'test-theme.json'): Promise<void> {
		await this.page.evaluate((data) => {
			const { theme, name } = data;
			
			// Simulate localStorage update
			localStorage.setItem('voice-terminal-theme', JSON.stringify(theme));
			
			// Simulate file system event
			window.dispatchEvent(new StorageEvent('storage', {
				key: 'voice-terminal-theme',
				newValue: JSON.stringify(theme),
				url: window.location.href
			}));
		}, { theme: themeData, name: filename });

		await this.page.waitForTimeout(100);
	}

	/**
	 * Get accessibility tree information
	 */
	async getAccessibilityInfo(selector: string): Promise<{
		role: string | null;
		label: string | null;
		description: string | null;
		hasKeyboardAccess: boolean;
	}> {
		const element = this.page.locator(selector);
		
		return await element.evaluate((el) => {
			return {
				role: el.getAttribute('role') || el.tagName.toLowerCase(),
				label: el.getAttribute('aria-label') || el.getAttribute('alt') || (el as any).innerText?.substring(0, 50),
				description: el.getAttribute('aria-describedby'),
				hasKeyboardAccess: el.tabIndex >= 0 || ['a', 'button', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase())
			};
		});
	}

	/**
	 * Test component inheritance behavior
	 */
	async testComponentInheritance(componentName: string, testProperty: string): Promise<{
		inheritsGlobal: boolean;
		hasOverrides: boolean;
		finalValue: string;
	}> {
		return await this.page.evaluate((data) => {
			const { component, property } = data;
			const themeStore = (window as any).__themeStore;
			if (!themeStore) throw new Error('ThemeStore not available');

			// Get current theme
			const currentTheme = themeStore.getTheme();
			const componentConfig = currentTheme.theme.components[component];
			
			if (!componentConfig) {
				return {
					inheritsGlobal: false,
					hasOverrides: false,
					finalValue: ''
				};
			}

			const inheritsGlobal = componentConfig.inherit;
			const hasOverrides = componentConfig.overrides && property in componentConfig.overrides;
			
			// Get the final computed value
			const testElement = document.querySelector(`[data-component="${component}"]`);
			const finalValue = testElement ? 
				window.getComputedStyle(testElement).getPropertyValue(`--${component}-${property}`) : '';

			return {
				inheritsGlobal,
				hasOverrides,
				finalValue: finalValue.trim()
			};
		}, { component: componentName, property: testProperty });
	}
}

/**
 * Custom assertion helpers
 */
export async function expectThemePerformance(page: Page, maxDuration: number) {
	const helpers = new ThemeTestHelpers(page);
	const duration = await helpers.measureThemeSwitchPerformance('default', 'ocean');
	expect(duration).toBeLessThan(maxDuration);
}

export async function expectAccessibleContrast(page: Page, backgroundSelector: string, textSelector: string, minRatio = 4.5) {
	const helpers = new ThemeTestHelpers(page);
	
	const bgColor = await page.locator(backgroundSelector).evaluate(el => 
		window.getComputedStyle(el).backgroundColor
	);
	const textColor = await page.locator(textSelector).evaluate(el => 
		window.getComputedStyle(el).color
	);

	// Convert RGB to hex for contrast calculation
	const rgbToHex = (rgb: string) => {
		const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (!match) return rgb;
		
		const [, r, g, b] = match;
		return `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;
	};

	const bgHex = rgbToHex(bgColor);
	const textHex = rgbToHex(textColor);

	if (bgHex.startsWith('#') && textHex.startsWith('#')) {
		const ratio = await helpers.calculateContrastRatio(bgHex, textHex);
		expect(ratio).toBeGreaterThanOrEqual(minRatio);
	}
}

export async function expectNoMemoryLeaks(page: Page, maxIncreasePercent = 10) {
	const helpers = new ThemeTestHelpers(page);
	const memoryInfo = await helpers.checkMemoryUsage();
	
	if (memoryInfo) {
		expect(memoryInfo.percentIncrease).toBeLessThan(maxIncreasePercent);
	}
}

export async function expectCSSVariablesSet(page: Page) {
	const helpers = new ThemeTestHelpers(page);
	const validation = await helpers.validateRequiredCSSVariables();
	
	expect(validation.valid).toBe(true);
	if (!validation.valid) {
		console.error('Missing CSS variables:', validation.missing);
	}
}

// Re-export all helper classes for convenience
export { VoiceTestHelpers } from './voice-helpers';
export { JSONEditingHelpers } from './json-editing-helpers';
export { PageFactory, ThemeSettingsPage, VoiceControlPage, ThemePreviewPage, PerformancePage } from './page-objects';