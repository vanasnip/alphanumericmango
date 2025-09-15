import { vi } from 'vitest';
import { render, type RenderResult } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { themeStore } from '$lib/stores/theme.js';
import type { ComponentType } from 'svelte';

/**
 * Test utilities for voice terminal hybrid application
 */

// Theme testing utilities
export const themeTestUtils = {
	/**
	 * Reset theme to default state for testing
	 */
	resetTheme: () => {
		themeStore.reset();
	},

	/**
	 * Apply a test theme configuration
	 */
	applyTestTheme: (themeOverrides: any) => {
		themeStore.update(current => ({
			...current,
			...themeOverrides
		}));
	},

	/**
	 * Get current theme colors for assertions
	 */
	getCurrentColors: () => {
		const theme = get(themeStore);
		return theme.global.colors;
	},

	/**
	 * Wait for theme changes to propagate
	 */
	waitForThemeChange: async (callback: () => void) => {
		callback();
		// Allow time for reactive updates
		await new Promise(resolve => setTimeout(resolve, 50));
	},

	/**
	 * Create a theme preset for testing
	 */
	createTestPreset: (name: string, config: any) => {
		return {
			[name]: config
		};
	}
};

// Mock utilities
export const mockUtils = {
	/**
	 * Mock localStorage with spy functions
	 */
	mockLocalStorage: () => {
		const localStorageMock = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		};

		Object.defineProperty(window, 'localStorage', {
			value: localStorageMock,
			writable: true
		});

		return localStorageMock;
	},

	/**
	 * Mock fetch for settings loading
	 */
	mockFetch: (responseData?: any) => {
		const mockFetch = vi.fn();
		
		if (responseData) {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(responseData)
			});
		} else {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({})
			});
		}

		global.fetch = mockFetch;
		return mockFetch;
	},

	/**
	 * Mock voice recognition API
	 */
	mockVoiceRecognition: (config?: {
		supported?: boolean;
		listening?: boolean;
		transcript?: string;
		confidence?: number;
	}) => {
		const defaultConfig = {
			supported: true,
			listening: false,
			transcript: '',
			confidence: 0.8
		};

		const mockConfig = { ...defaultConfig, ...config };

		return {
			supported: mockConfig.supported,
			listening: mockConfig.listening,
			start: vi.fn((onResult, onError, onEnd) => {
				if (mockConfig.transcript) {
					setTimeout(() => {
						onResult({
							transcript: mockConfig.transcript,
							confidence: mockConfig.confidence,
							isFinal: true
						});
					}, 100);
				}
			}),
			stop: vi.fn()
		};
	},

	/**
	 * Mock media queries for responsive testing
	 */
	mockMediaQuery: (query: string, matches: boolean = false) => {
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation(q => ({
				matches: q === query ? matches : false,
				media: q,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	},

	/**
	 * Mock file operations
	 */
	mockFileOperations: () => {
		const mockCreateObjectURL = vi.fn(() => 'mock-url');
		const mockRevokeObjectURL = vi.fn();
		
		Object.defineProperty(URL, 'createObjectURL', {
			value: mockCreateObjectURL,
			writable: true
		});
		
		Object.defineProperty(URL, 'revokeObjectURL', {
			value: mockRevokeObjectURL,
			writable: true
		});

		return { mockCreateObjectURL, mockRevokeObjectURL };
	}
};

// Component testing utilities
export const componentTestUtils = {
	/**
	 * Render component with theme context
	 */
	renderWithTheme: <T extends ComponentType>(
		component: T, 
		props?: any, 
		themeOverrides?: any
	): RenderResult<T> => {
		if (themeOverrides) {
			themeTestUtils.applyTestTheme(themeOverrides);
		}

		return render(component, props);
	},

	/**
	 * Wait for component to update after theme change
	 */
	waitForComponentUpdate: async (element: Element | null, expectedStyle: string) => {
		if (!element) {
			throw new Error('Element not found for style assertion');
		}

		let attempts = 0;
		const maxAttempts = 50; // 5 seconds at 100ms intervals

		while (attempts < maxAttempts) {
			const style = element.getAttribute('style');
			if (style && style.includes(expectedStyle)) {
				return true;
			}
			
			await new Promise(resolve => setTimeout(resolve, 100));
			attempts++;
		}

		throw new Error(`Expected style "${expectedStyle}" not found after ${maxAttempts * 100}ms`);
	},

	/**
	 * Get computed theme variables from element
	 */
	getThemeVariables: (element: Element): Record<string, string> => {
		const style = element.getAttribute('style') || '';
		const variables: Record<string, string> = {};
		
		// Parse CSS custom properties from style attribute
		const matches = style.match(/--[\w-]+:\s*[^;]+/g);
		if (matches) {
			matches.forEach(match => {
				const [property, value] = match.split(':').map(s => s.trim());
				variables[property] = value;
			});
		}
		
		return variables;
	},

	/**
	 * Assert that component has correct theme variables
	 */
	assertThemeVariables: (
		element: Element | null, 
		expectedVariables: Record<string, string>
	) => {
		if (!element) {
			throw new Error('Element not found for theme variable assertion');
		}

		const actualVariables = componentTestUtils.getThemeVariables(element);
		
		Object.entries(expectedVariables).forEach(([property, expectedValue]) => {
			const actualValue = actualVariables[property];
			if (!actualValue || !actualValue.includes(expectedValue)) {
				throw new Error(
					`Expected theme variable ${property} to contain "${expectedValue}", ` +
					`but got "${actualValue}"`
				);
			}
		});
	}
};

// Event testing utilities
export const eventTestUtils = {
	/**
	 * Create a promise that resolves when a custom event is dispatched
	 */
	waitForEvent: <T = any>(
		component: any, 
		eventName: string, 
		timeout: number = 5000
	): Promise<T> => {
		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Event "${eventName}" not dispatched within ${timeout}ms`));
			}, timeout);

			component.$on(eventName, (event: CustomEvent<T>) => {
				clearTimeout(timeoutId);
				resolve(event.detail);
			});
		});
	},

	/**
	 * Dispatch a custom event on a component
	 */
	dispatchEvent: (component: any, eventName: string, detail?: any) => {
		component.$set({ [eventName]: detail });
	}
};

// Accessibility testing utilities
export const a11yTestUtils = {
	/**
	 * Check if element has required ARIA attributes
	 */
	assertAriaAttributes: (
		element: Element | null, 
		requiredAttributes: string[]
	) => {
		if (!element) {
			throw new Error('Element not found for ARIA assertion');
		}

		requiredAttributes.forEach(attr => {
			if (!element.hasAttribute(attr)) {
				throw new Error(`Element missing required ARIA attribute: ${attr}`);
			}
		});
	},

	/**
	 * Check if element is keyboard accessible
	 */
	assertKeyboardAccessible: (element: Element | null) => {
		if (!element) {
			throw new Error('Element not found for keyboard accessibility assertion');
		}

		const tabIndex = element.getAttribute('tabindex');
		const role = element.getAttribute('role');
		
		if (tabIndex === '-1' && !role) {
			throw new Error('Element is not keyboard accessible (tabindex=-1 without role)');
		}
	},

	/**
	 * Check if element has proper focus indicators
	 */
	assertFocusIndicators: (element: Element | null) => {
		if (!element) {
			throw new Error('Element not found for focus indicator assertion');
		}

		// This would typically check computed styles for focus-visible
		// For now, we'll check that the element can receive focus
		if (element instanceof HTMLElement && element.tabIndex < 0) {
			throw new Error('Element cannot receive focus');
		}
	}
};

// Performance testing utilities
export const performanceTestUtils = {
	/**
	 * Measure rendering performance
	 */
	measureRenderTime: async (renderFn: () => any): Promise<number> => {
		const start = performance.now();
		await renderFn();
		const end = performance.now();
		return end - start;
	},

	/**
	 * Measure theme switching performance
	 */
	measureThemeSwitchTime: async (
		switchFn: () => void,
		verifyFn: () => boolean
	): Promise<number> => {
		const start = performance.now();
		switchFn();
		
		// Wait for the change to take effect
		while (!verifyFn() && (performance.now() - start) < 5000) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}
		
		const end = performance.now();
		return end - start;
	},

	/**
	 * Assert performance meets threshold
	 */
	assertPerformanceThreshold: (duration: number, threshold: number, operation: string) => {
		if (duration > threshold) {
			throw new Error(
				`${operation} took ${duration}ms, exceeding threshold of ${threshold}ms`
			);
		}
	}
};

// Test data factories
export const testDataFactories = {
	/**
	 * Create a test theme configuration
	 */
	createTestTheme: (overrides: any = {}) => ({
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
				text: '#F9FAFB',
				...overrides.colors
			},
			typography: {
				fontFamily: 'Inter, system-ui',
				fontSize: {
					base: '16px',
					scale: 1.25
				},
				...overrides.typography
			},
			spacing: {
				unit: '0.25rem',
				scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32],
				...overrides.spacing
			},
			borders: {
				radius: {
					none: '0',
					sm: '0.125rem',
					md: '0.375rem',
					lg: '0.5rem',
					full: '9999px'
				},
				width: '1px',
				style: 'solid',
				...overrides.borders
			}
		},
		components: {
			terminal: {
				inherit: false,
				background: '#000000',
				fontFamily: 'JetBrains Mono, monospace'
			},
			voiceIndicator: {
				inherit: true,
				overrides: {
					activeColor: '#10B981'
				}
			},
			...overrides.components
		}
	}),

	/**
	 * Create test voice recognition result
	 */
	createVoiceResult: (overrides: any = {}) => ({
		transcript: 'test command',
		confidence: 0.9,
		isFinal: true,
		...overrides
	}),

	/**
	 * Create test terminal line
	 */
	createTerminalLine: (overrides: any = {}) => ({
		id: Math.random().toString(36).substr(2, 9),
		type: 'output',
		content: 'Test output',
		timestamp: new Date(),
		outputType: 'info',
		isTyping: false,
		...overrides
	})
};

export default {
	theme: themeTestUtils,
	mock: mockUtils,
	component: componentTestUtils,
	event: eventTestUtils,
	a11y: a11yTestUtils,
	performance: performanceTestUtils,
	data: testDataFactories
};