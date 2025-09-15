import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeValidator } from './themeValidator';
import type { AppTheme } from '../stores/themeStore';

describe('ThemeValidator', () => {
	describe('JSON Schema Validation', () => {
		it('should validate a complete valid theme', () => {
			const validTheme: AppTheme = {
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
							scale: [1, 2, 3, 4, 6, 8]
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
							background: '#000000'
						}
					}
				}
			};

			const result = themeValidator.validate(validTheme);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate a minimal valid theme', () => {
			const minimalTheme = {
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
							fontSize: {
								base: '16px',
								scale: 1.25
							}
						},
						spacing: {
							unit: '0.25rem',
							scale: [1]
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
					components: {}
				}
			};

			const result = themeValidator.validate(minimalTheme);
			expect(result.valid).toBe(true);
		});

		it('should reject theme with missing required properties', () => {
			const incompleteTheme = {
				theme: {
					mode: 'dark'
					// Missing preset, global
				}
			};

			const result = themeValidator.validate(incompleteTheme);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.some(e => e.message.includes('preset'))).toBe(true);
		});

		it('should reject invalid color formats', () => {
			const invalidColorTheme = {
				theme: {
					mode: 'dark',
					preset: 'default',
					global: {
						colors: {
							primary: 'not-a-color',
							secondary: '#GGGGGG',
							success: '#10B981',
							warning: '#F59E0B',
							error: '#EF4444',
							background: null,
							surface: '#374151',
							text: '#F9FAFB'
						},
						typography: {
							fontFamily: 'system-ui',
							fontSize: { base: '16px', scale: 1.25 }
						},
						spacing: {
							unit: '0.25rem',
							scale: [1]
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

			const result = themeValidator.validate(invalidColorTheme);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject invalid mode values', () => {
			const invalidModeTheme = {
				theme: {
					mode: 'invalid-mode',
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
							scale: [1]
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

			const result = themeValidator.validate(invalidModeTheme);
			expect(result.valid).toBe(false);
		});

		it('should handle malformed JSON gracefully', () => {
			const malformedTheme = {
				theme: {
					mode: 'dark',
					preset: 'default',
					global: {
						colors: {
							primary: '#3B82F6'
							// Missing comma - would cause JSON parse error in real scenario
						}
					}
				}
			};

			// Simulate what would happen with actual malformed JSON
			const result = themeValidator.validate(malformedTheme);
			expect(result.valid).toBe(false);
		});
	});

	describe('Accessibility Validation', () => {
		it('should warn about poor contrast ratios', () => {
			const poorContrastTheme = {
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
							background: '#333333',
							surface: '#374151',
							text: '#444444' // Poor contrast with background
						},
						typography: {
							fontFamily: 'system-ui',
							fontSize: { base: '16px', scale: 1.25 }
						},
						spacing: {
							unit: '0.25rem',
							scale: [1]
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

			const result = themeValidator.validate(poorContrastTheme);
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings.some(w => w.message.includes('contrast'))).toBe(true);
		});

		it('should validate good contrast ratios', () => {
			const goodContrastTheme = {
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
							background: '#000000',
							surface: '#374151',
							text: '#FFFFFF' // Good contrast with background
						},
						typography: {
							fontFamily: 'system-ui',
							fontSize: { base: '16px', scale: 1.25 }
						},
						spacing: {
							unit: '0.25rem',
							scale: [1]
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

			const result = themeValidator.validate(goodContrastTheme);
			const contrastWarnings = result.warnings.filter(w => w.message.includes('contrast'));
			expect(contrastWarnings.length).toBe(0);
		});
	});

	describe('Performance Validation', () => {
		it('should warn about large theme configurations', () => {
			// Create a large theme object
			const largeColors: Record<string, string> = {};
			for (let i = 0; i < 1000; i++) {
				largeColors[`color${i}`] = '#FF0000';
			}

			const largeTheme = {
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
							text: '#F9FAFB',
							...largeColors
						},
						typography: {
							fontFamily: 'system-ui',
							fontSize: { base: '16px', scale: 1.25 }
						},
						spacing: {
							unit: '0.25rem',
							scale: [1]
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

			const result = themeValidator.validate(largeTheme);
			expect(result.warnings.some(w => w.message.includes('performance'))).toBe(true);
		});

		it('should warn about excessive nesting depth', () => {
			// Create deeply nested structure
			let deepObject: any = {};
			let current = deepObject;
			for (let i = 0; i < 15; i++) {
				current.nested = {};
				current = current.nested;
			}

			const deepTheme = {
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
							scale: [1]
						},
						borders: {
							radius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
							width: '1px',
							style: 'solid'
						}
					},
					components: {},
					deep: deepObject
				}
			};

			const result = themeValidator.validate(deepTheme);
			expect(result.warnings.some(w => w.message.includes('nesting depth'))).toBe(true);
		});

		it('should warn about excessive spacing scale', () => {
			const longSpacingTheme = {
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
							scale: Array.from({ length: 25 }, (_, i) => i + 1) // 25 values
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

			const result = themeValidator.validate(longSpacingTheme);
			expect(result.warnings.some(w => w.message.includes('spacing scale'))).toBe(true);
		});

		it('should complete validation within performance target', () => {
			const theme = {
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

			const start = performance.now();
			const result = themeValidator.validate(theme);
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(10); // 10ms target
			expect(result.warnings.some(w => w.path === 'validation')).toBe(false);
		});
	});

	describe('Browser Compatibility Validation', () => {
		it('should warn about modern CSS color functions', () => {
			const modernColorTheme = {
				theme: {
					mode: 'dark',
					preset: 'default',
					global: {
						colors: {
							primary: 'oklch(0.7 0.15 200)',
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
							scale: [1]
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

			const result = themeValidator.validate(modernColorTheme);
			expect(result.warnings.some(w => w.message.includes('modern CSS syntax'))).toBe(true);
		});

		it('should warn about CSS custom properties without fallbacks', () => {
			const customPropertyTheme = {
				theme: {
					mode: 'dark',
					preset: 'default',
					global: {
						colors: {
							primary: 'var(--brand-primary)',
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
							scale: [1]
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

			const result = themeValidator.validate(customPropertyTheme);
			expect(result.warnings.some(w => w.message.includes('custom properties'))).toBe(true);
		});
	});

	describe('Theme Sanitization', () => {
		it('should sanitize invalid themes to safe defaults', () => {
			const invalidTheme = {
				theme: {
					mode: 'invalid-mode',
					global: {
						colors: {
							primary: 'not-a-color',
							background: null
						}
					}
				}
			};

			const sanitized = themeValidator.sanitizeTheme(invalidTheme);
			expect(sanitized).toBeDefined();
			expect(sanitized.theme.mode).toEqual('dark');
			expect(sanitized.theme.global.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
		});

		it('should return valid themes unchanged', () => {
			const validTheme = {
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
							scale: [1]
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

			const sanitized = themeValidator.sanitizeTheme(validTheme);
			expect(sanitized).toEqual(validTheme);
		});
	});
});