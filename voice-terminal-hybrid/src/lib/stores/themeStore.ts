import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface ThemeColors {
	primary: string;
	secondary: string;
	success: string;
	warning: string;
	error: string;
	background: string;
	surface: string;
	text: string;
}

export interface ThemeTypography {
	fontFamily: string;
	fontSize: {
		base: string;
		scale: number;
	};
}

export interface ThemeSpacing {
	unit: string;
	scale: number[];
}

export interface ThemeBorders {
	radius: {
		none: string;
		sm: string;
		md: string;
		lg: string;
		full: string;
	};
	width: string;
	style: string;
}

export interface ThemeGlobal {
	colors: ThemeColors;
	typography: ThemeTypography;
	spacing: ThemeSpacing;
	borders: ThemeBorders;
}

export interface ThemeComponent {
	inherit: boolean;
	overrides?: Record<string, any>;
	[key: string]: any;
}

export interface ThemeConfig {
	mode: 'dark' | 'light' | 'auto';
	preset: 'default' | 'ocean' | 'forest' | 'custom';
	global: ThemeGlobal;
	components: Record<string, ThemeComponent>;
}

export interface AppTheme {
	theme: ThemeConfig;
}

// Default theme configuration
export const defaultTheme: AppTheme = {
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
				fontFamily: 'Inter, system-ui',
				fontSize: {
					base: '16px',
					scale: 1.25
				}
			},
			spacing: {
				unit: '0.25rem',
				scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
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
					activeColor: '#10B981',
					pulseAnimation: '2s ease-in-out infinite'
				}
			}
		}
	}
};

// Theme presets
export const themePresets: Record<string, Partial<ThemeConfig>> = {
	default: {},
	ocean: {
		global: {
			colors: {
				primary: '#0EA5E9',
				secondary: '#06B6D4',
				success: '#10B981',
				warning: '#F59E0B',
				error: '#EF4444',
				background: '#0F172A',
				surface: '#1E293B',
				text: '#F1F5F9'
			}
		}
	},
	forest: {
		global: {
			colors: {
				primary: '#16A34A',
				secondary: '#059669',
				success: '#22C55E',
				warning: '#EAB308',
				error: '#DC2626',
				background: '#14532D',
				surface: '#166534',
				text: '#F0FDF4'
			}
		}
	}
};

class ThemeStore {
	private store: Writable<AppTheme>;
	private watchers: Set<() => void> = new Set();

	constructor() {
		this.store = writable(this.loadTheme());
		this.setupFileWatcher();
	}

	private loadTheme(): AppTheme {
		if (typeof window === 'undefined') return defaultTheme;

		try {
			const stored = localStorage.getItem('voice-terminal-theme');
			if (stored) {
				const parsed = JSON.parse(stored);
				return this.validateAndMergeTheme(parsed);
			}
		} catch (error) {
			console.warn('Failed to load theme from localStorage:', error);
		}

		return defaultTheme;
	}

	private validateAndMergeTheme(theme: any): AppTheme {
		// Deep merge with default theme to ensure all required properties exist
		const merged = this.deepMerge(defaultTheme, theme);
		
		// Validate colors
		if (merged.theme.global?.colors) {
			Object.keys(merged.theme.global.colors).forEach(key => {
				const color = merged.theme.global.colors[key as keyof ThemeColors];
				if (!this.isValidColor(color)) {
					merged.theme.global.colors[key as keyof ThemeColors] = 
						defaultTheme.theme.global.colors[key as keyof ThemeColors];
				}
			});
		}

		return merged;
	}

	private isValidColor(color: string): boolean {
		if (typeof color !== 'string') return false;
		
		// Check hex colors
		const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		if (hexRegex.test(color)) return true;

		// Check named colors and other valid CSS color values
		const testDiv = document.createElement('div');
		testDiv.style.color = color;
		return testDiv.style.color !== '';
	}

	private deepMerge(target: any, source: any): any {
		const result = { ...target };
		
		for (const key in source) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(target[key] || {}, source[key]);
			} else {
				result[key] = source[key];
			}
		}
		
		return result;
	}

	private setupFileWatcher() {
		// In a real implementation, this would watch for file system changes
		// For now, we'll simulate with periodic localStorage checks
		if (typeof window !== 'undefined') {
			window.addEventListener('storage', (e) => {
				if (e.key === 'voice-terminal-theme') {
					this.reloadTheme();
				}
			});
		}
	}

	private reloadTheme() {
		const newTheme = this.loadTheme();
		this.store.set(newTheme);
		this.applyTheme(newTheme);
		this.notifyWatchers();
	}

	private applyTheme(theme: AppTheme) {
		if (typeof document === 'undefined') return;

		const start = performance.now();

		// Apply CSS custom properties
		const root = document.documentElement;
		const colors = theme.theme.global.colors;
		const typography = theme.theme.global.typography;
		const spacing = theme.theme.global.spacing;
		const borders = theme.theme.global.borders;

		// Set color variables
		Object.entries(colors).forEach(([key, value]) => {
			root.style.setProperty(`--theme-${key}`, value);
		});

		// Set typography variables
		root.style.setProperty('--theme-font-family', typography.fontFamily);
		root.style.setProperty('--theme-font-size', typography.fontSize.base);
		root.style.setProperty('--theme-font-scale', typography.fontSize.scale.toString());

		// Set spacing variables
		root.style.setProperty('--theme-spacing-unit', spacing.unit);
		spacing.scale.forEach((value, index) => {
			root.style.setProperty(`--theme-spacing-${index}`, `calc(${spacing.unit} * ${value})`);
		});

		// Set border variables
		Object.entries(borders.radius).forEach(([key, value]) => {
			root.style.setProperty(`--theme-border-radius-${key}`, value);
		});
		root.style.setProperty('--theme-border-width', borders.width);
		root.style.setProperty('--theme-border-style', borders.style);

		// Apply component-specific styles
		Object.entries(theme.theme.components).forEach(([componentName, config]) => {
			Object.entries(config).forEach(([prop, value]) => {
				if (prop !== 'inherit' && prop !== 'overrides') {
					root.style.setProperty(`--${componentName}-${prop}`, value.toString());
				}
			});

			if (config.overrides) {
				Object.entries(config.overrides).forEach(([prop, value]) => {
					root.style.setProperty(`--${componentName}-${prop}`, value.toString());
				});
			}
		});

		const end = performance.now();
		const duration = end - start;

		// Performance monitoring
		if (duration > 100) {
			console.warn(`Theme application took ${duration}ms, exceeding 100ms target`);
		}

		// Trigger custom event for theme change
		document.dispatchEvent(new CustomEvent('theme-changed', {
			detail: { theme, duration }
		}));
	}

	private notifyWatchers() {
		this.watchers.forEach(watcher => watcher());
	}

	// Public API
	subscribe(callback: (theme: AppTheme) => void) {
		return this.store.subscribe(callback);
	}

	setTheme(theme: Partial<AppTheme>) {
		this.store.update(current => {
			const merged = this.deepMerge(current, theme);
			const validated = this.validateAndMergeTheme(merged);
			
			// Persist to localStorage
			if (typeof window !== 'undefined') {
				localStorage.setItem('voice-terminal-theme', JSON.stringify(validated));
			}
			
			this.applyTheme(validated);
			return validated;
		});
	}

	setPreset(presetName: keyof typeof themePresets) {
		const preset = themePresets[presetName];
		if (preset) {
			this.setTheme({
				theme: {
					...preset,
					preset: presetName
				}
			});
		}
	}

	setMode(mode: 'dark' | 'light' | 'auto') {
		this.setTheme({
			theme: {
				mode
			}
		});
	}

	getTheme(): AppTheme {
		let currentTheme: AppTheme = defaultTheme;
		this.store.subscribe(theme => currentTheme = theme)();
		return currentTheme;
	}

	resetToDefault() {
		this.setTheme(defaultTheme);
	}

	addWatcher(callback: () => void) {
		this.watchers.add(callback);
		return () => this.watchers.delete(callback);
	}

	// Performance monitoring
	measureThemeSwitch(): Promise<number> {
		return new Promise((resolve) => {
			const start = performance.now();
			
			const cleanup = this.addWatcher(() => {
				const end = performance.now();
				const duration = end - start;
				cleanup();
				resolve(duration);
			});
		});
	}
}

export const themeStore = new ThemeStore();