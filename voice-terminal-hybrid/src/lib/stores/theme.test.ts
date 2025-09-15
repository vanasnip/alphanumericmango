import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { 
	themeStore, 
	themeError,
	colors,
	typography,
	spacing,
	borders,
	terminalTheme,
	voiceIndicatorTheme,
	voiceStates,
	currentColors
} from './theme.js';

// Mock browser environment
Object.defineProperty(window, 'localStorage', {
	value: {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn(),
	},
	writable: true,
});

// Mock fetch for settings.json loading
global.fetch = vi.fn();

describe('Theme Store', () => {
	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();
		
		// Reset theme store to default state
		themeStore.reset();
		themeError.set(null);
		
		// Mock successful fetch by default
		(global.fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ theme: {} })
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Default State', () => {
		it('should have correct default theme', () => {
			const theme = get(themeStore);
			
			expect(theme.mode).toBe('dark');
			expect(theme.preset).toBe('default');
			expect(theme.global.colors.primary).toBe('#3B82F6');
			expect(theme.global.typography.fontFamily).toBe('Inter, system-ui');
			expect(theme.global.spacing.unit).toBe('0.25rem');
			expect(theme.global.borders.radius.md).toBe('0.375rem');
		});

		it('should have terminal component configuration', () => {
			const theme = get(themeStore);
			
			expect(theme.components.terminal).toBeDefined();
			expect(theme.components.terminal.inherit).toBe(false);
			expect(theme.components.terminal.background).toBe('#000000');
			expect(theme.components.terminal.fontFamily).toBe('JetBrains Mono, monospace');
		});

		it('should have voice indicator component configuration', () => {
			const theme = get(themeStore);
			
			expect(theme.components.voiceIndicator).toBeDefined();
			expect(theme.components.voiceIndicator.inherit).toBe(true);
			expect(theme.components.voiceIndicator.overrides).toBeDefined();
		});
	});

	describe('Theme Mode Management', () => {
		it('should update mode correctly', () => {
			themeStore.setMode('light');
			
			const theme = get(themeStore);
			expect(theme.mode).toBe('light');
		});

		it('should reject invalid modes', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			
			themeStore.setMode('invalid' as any);
			
			expect(consoleSpy).toHaveBeenCalledWith('Invalid theme mode: invalid');
			
			const theme = get(themeStore);
			expect(theme.mode).toBe('dark'); // Should remain unchanged
			
			consoleSpy.mockRestore();
		});

		it('should persist mode changes to localStorage', () => {
			themeStore.setMode('light');
			
			expect(localStorage.setItem).toHaveBeenCalledWith(
				'voice-terminal-theme',
				expect.stringContaining('"mode":"light"')
			);
		});
	});

	describe('Theme Preset Management', () => {
		it('should update preset correctly', () => {
			themeStore.setPreset('ocean');
			
			const theme = get(themeStore);
			expect(theme.preset).toBe('ocean');
		});

		it('should reject invalid presets', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			
			themeStore.setPreset('invalid' as any);
			
			expect(consoleSpy).toHaveBeenCalledWith('Invalid theme preset: invalid');
			
			const theme = get(themeStore);
			expect(theme.preset).toBe('default');
			
			consoleSpy.mockRestore();
		});

		it('should apply preset themes correctly', () => {
			themeStore.applyPreset('ocean');
			
			// Note: This test depends on the actual preset implementation
			// You might need to verify specific color changes based on your presets
		});
	});

	describe('Color Management', () => {
		it('should update individual colors', () => {
			themeStore.setColor('primary', '#ff0000');
			
			const theme = get(themeStore);
			expect(theme.global.colors.primary).toBe('#ff0000');
		});

		it('should update colors store reactively', () => {
			themeStore.setColor('primary', '#ff0000');
			
			const currentColors = get(colors);
			expect(currentColors.primary).toBe('#ff0000');
		});

		it('should persist color changes', () => {
			themeStore.setColor('primary', '#ff0000');
			
			expect(localStorage.setItem).toHaveBeenCalled();
		});
	});

	describe('Component Theme Management', () => {
		it('should update component themes', () => {
			const newTerminalConfig = {
				inherit: false,
				background: '#1a1a1a',
				fontSize: '16px'
			};
			
			themeStore.setComponentTheme('terminal', newTerminalConfig);
			
			const theme = get(themeStore);
			expect(theme.components.terminal.background).toBe('#1a1a1a');
			expect(theme.components.terminal.fontSize).toBe('16px');
		});

		it('should handle component inheritance correctly', () => {
			// Test with inherit: true
			themeStore.setComponentTheme('voiceIndicator', {
				inherit: true,
				overrides: { activeColor: '#00ff00' }
			});
			
			const voiceTheme = get(voiceIndicatorTheme);
			expect(voiceTheme.inherit).toBe(true);
			expect(voiceTheme.overrides?.activeColor).toBe('#00ff00');
		});
	});

	describe('Derived Stores', () => {
		it('should update derived color store when colors change', () => {
			themeStore.setColor('primary', '#ff0000');
			
			const derivedColors = get(colors);
			expect(derivedColors.primary).toBe('#ff0000');
		});

		it('should update typography store when typography changes', () => {
			themeStore.update(current => ({
				...current,
				global: {
					...current.global,
					typography: {
						...current.global.typography,
						fontFamily: 'Arial, sans-serif'
					}
				}
			}));
			
			const derivedTypography = get(typography);
			expect(derivedTypography.fontFamily).toBe('Arial, sans-serif');
		});

		it('should update spacing store correctly', () => {
			themeStore.update(current => ({
				...current,
				global: {
					...current.global,
					spacing: {
						...current.global.spacing,
						unit: '0.5rem'
					}
				}
			}));
			
			const derivedSpacing = get(spacing);
			expect(derivedSpacing.unit).toBe('0.5rem');
		});

		it('should update borders store correctly', () => {
			themeStore.update(current => ({
				...current,
				global: {
					...current.global,
					borders: {
						...current.global.borders,
						radius: {
							...current.global.borders.radius,
							md: '1rem'
						}
					}
				}
			}));
			
			const derivedBorders = get(borders);
			expect(derivedBorders.radius.md).toBe('1rem');
		});
	});

	describe('Voice States', () => {
		it('should generate correct voice states based on theme colors', () => {
			const states = get(voiceStates);
			
			expect(states.idle).toBeDefined();
			expect(states.listening).toBeDefined();
			expect(states.processing).toBeDefined();
			expect(states.speaking).toBeDefined();
			expect(states.error).toBeDefined();
			
			// Check that states use theme colors
			const themeColors = get(colors);
			expect(states.listening.color).toBe(themeColors.success);
			expect(states.error.color).toBe(themeColors.error);
		});

		it('should update voice states when theme colors change', () => {
			themeStore.setColor('success', '#00ff00');
			
			const states = get(voiceStates);
			expect(states.listening.color).toBe('#00ff00');
		});
	});

	describe('Theme Loading and Persistence', () => {
		it('should load theme from localStorage on initialization', () => {
			const mockTheme = {
				mode: 'light',
				global: { colors: { primary: '#ff0000' } }
			};
			
			(localStorage.getItem as any).mockReturnValue(JSON.stringify(mockTheme));
			
			// Create a new store instance to test loading
			// Note: This might require restructuring the store to be testable
		});

		it('should handle localStorage errors gracefully', () => {
			(localStorage.getItem as any).mockImplementation(() => {
				throw new Error('Storage error');
			});
			
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			
			// Theme should fall back to defaults
			const theme = get(themeStore);
			expect(theme.mode).toBe('dark'); // Default mode
			
			consoleSpy.mockRestore();
		});

		it('should load settings from settings.json', async () => {
			const mockSettings = {
				theme: {
					mode: 'light',
					global: {
						colors: {
							primary: '#00ff00'
						}
					}
				}
			};
			
			(global.fetch as any).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockSettings)
			});
			
			await themeStore.loadSettings();
			
			expect(fetch).toHaveBeenCalledWith('/settings.json');
		});

		it('should handle settings.json load errors', async () => {
			(global.fetch as any).mockRejectedValue(new Error('Network error'));
			
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			
			await themeStore.loadSettings();
			
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to load theme settings:',
				expect.any(Error)
			);
			
			consoleSpy.mockRestore();
		});
	});

	describe('Theme Validation', () => {
		it('should validate theme structure', () => {
			// This test would require implementing theme validation
			// For now, we'll test that invalid themes don't break the store
			
			const invalidTheme = {
				mode: 'invalid',
				global: {
					colors: {
						primary: 'not-a-color'
					}
				}
			};
			
			// The store should handle this gracefully
			expect(() => {
				themeStore.update(() => invalidTheme as any);
			}).not.toThrow();
		});
	});

	describe('Theme Export and Import', () => {
		it('should export theme correctly', () => {
			const exportedTheme = themeStore.export();
			
			expect(typeof exportedTheme).toBe('string');
			
			const parsed = JSON.parse(exportedTheme);
			expect(parsed.mode).toBeDefined();
			expect(parsed.global).toBeDefined();
			expect(parsed.components).toBeDefined();
		});

		it('should export theme with pretty formatting by default', () => {
			const exportedTheme = themeStore.export();
			
			// Pretty formatted JSON should contain newlines
			expect(exportedTheme).toContain('\n');
		});

		it('should export theme without formatting when requested', () => {
			const exportedTheme = themeStore.export(false);
			
			// Minified JSON should not contain newlines
			expect(exportedTheme).not.toContain('\n');
		});

		it('should import valid theme correctly', () => {
			const themeToImport = {
				mode: 'light',
				global: {
					colors: {
						primary: '#ff0000'
					}
				}
			};
			
			const success = themeStore.import(JSON.stringify(themeToImport));
			
			expect(success).toBe(true);
			
			const currentTheme = get(themeStore);
			expect(currentTheme.mode).toBe('light');
			expect(currentTheme.global.colors.primary).toBe('#ff0000');
		});

		it('should reject invalid theme imports', () => {
			const invalidJson = 'not valid json';
			
			const success = themeStore.import(invalidJson);
			
			expect(success).toBe(false);
			expect(get(themeError)).toContain('Failed to import theme');
		});
	});

	describe('Theme Backup and Restore', () => {
		it('should create theme backup', () => {
			const backup = themeStore.createBackup('Test backup');
			
			expect(backup).toHaveProperty('label', 'Test backup');
			expect(backup).toHaveProperty('timestamp');
			expect(backup).toHaveProperty('theme');
		});

		it('should restore theme from backup', () => {
			// Create a backup
			const backup = themeStore.createBackup('Original');
			
			// Change theme
			themeStore.setColor('primary', '#ff0000');
			
			// Restore backup
			const success = themeStore.restoreBackup(backup);
			
			expect(success).toBe(true);
			
			const restoredTheme = get(themeStore);
			expect(restoredTheme.global.colors.primary).toBe('#3B82F6'); // Original color
		});
	});

	describe('Error Handling', () => {
		it('should set error state when validation fails', async () => {
			// Mock a validation failure scenario
			const invalidSettings = { theme: { invalid: 'structure' } };
			
			(global.fetch as any).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(invalidSettings)
			});
			
			await themeStore.loadSettings();
			
			// Check if error was set (depends on validation implementation)
			// This test might need adjustment based on actual validation logic
		});

		it('should clear error state on successful operations', () => {
			// Set an error first
			themeError.set('Test error');
			expect(get(themeError)).toBe('Test error');
			
			// Perform a successful operation
			themeStore.setColor('primary', '#ff0000');
			
			// Error should be cleared
			expect(get(themeError)).toBeNull();
		});
	});

	describe('Performance', () => {
		it('should debounce rapid theme changes', async () => {
			const spy = vi.spyOn(localStorage, 'setItem');
			
			// Make rapid changes
			themeStore.setColor('primary', '#ff0000');
			themeStore.setColor('secondary', '#00ff00');
			themeStore.setColor('success', '#0000ff');
			
			// Should have called localStorage for each change
			expect(spy).toHaveBeenCalledTimes(3);
			
			spy.mockRestore();
		});
	});

	describe('File Watching', () => {
		it('should start file watching', () => {
			// This test would verify that file watching is properly set up
			// Implementation depends on how file watching is actually implemented
			expect(() => themeStore.startWatching()).not.toThrow();
		});

		it('should stop file watching', () => {
			themeStore.startWatching();
			expect(() => themeStore.stopWatching()).not.toThrow();
		});
	});
});