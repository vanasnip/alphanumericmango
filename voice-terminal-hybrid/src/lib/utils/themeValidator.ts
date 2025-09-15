import Ajv from 'ajv';
import type { AppTheme } from '../stores/themeStore';
import themeSchema from '../schemas/themeSchema.json';

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	path: string;
	message: string;
	value?: any;
}

export interface ValidationWarning {
	path: string;
	message: string;
	suggestion?: string;
}

class ThemeValidator {
	private ajv: Ajv;

	constructor() {
		this.ajv = new Ajv({ 
			allErrors: true,
			verbose: true,
			strict: false
		});
		this.ajv.addSchema(themeSchema, 'theme');
	}

	validate(theme: any): ValidationResult {
		const start = performance.now();
		
		const valid = this.ajv.validate('theme', theme);
		const errors: ValidationError[] = [];
		const warnings: ValidationWarning[] = [];

		// Collect schema validation errors
		if (!valid && this.ajv.errors) {
			this.ajv.errors.forEach(error => {
				errors.push({
					path: error.instancePath || error.schemaPath,
					message: error.message || 'Unknown validation error',
					value: error.data
				});
			});
		}

		// Additional custom validations
		if (theme?.theme) {
			this.validateAccessibility(theme.theme, warnings, errors);
			this.validatePerformance(theme.theme, warnings);
			this.validateBrowserCompatibility(theme.theme, warnings);
		}

		const end = performance.now();
		const duration = end - start;

		// Performance warning if validation takes too long
		if (duration > 10) {
			warnings.push({
				path: 'validation',
				message: `Theme validation took ${duration.toFixed(2)}ms, exceeding 10ms target`,
				suggestion: 'Consider simplifying theme structure'
			});
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	private validateAccessibility(theme: any, warnings: ValidationWarning[], errors: ValidationError[]) {
		if (!theme.global?.colors) return;

		const colors = theme.global.colors;
		
		// Check contrast ratios
		const contrastChecks = [
			{ bg: colors.background, fg: colors.text, name: 'background/text' },
			{ bg: colors.surface, fg: colors.text, name: 'surface/text' },
			{ bg: colors.primary, fg: colors.text, name: 'primary/text' },
			{ bg: colors.secondary, fg: colors.text, name: 'secondary/text' }
		];

		contrastChecks.forEach(check => {
			if (check.bg && check.fg) {
				const ratio = this.calculateContrastRatio(check.bg, check.fg);
				if (ratio < 4.5) {
					if (ratio < 3) {
						errors.push({
							path: `theme.global.colors`,
							message: `Contrast ratio between ${check.name} is ${ratio.toFixed(2)}, below WCAG AA minimum (4.5:1)`,
							value: { background: check.bg, foreground: check.fg }
						});
					} else {
						warnings.push({
							path: `theme.global.colors`,
							message: `Contrast ratio between ${check.name} is ${ratio.toFixed(2)}, below recommended 4.5:1`,
							suggestion: 'Adjust colors to meet WCAG AA guidelines'
						});
					}
				}
			}
		});

		// Check for color-only communication
		const semanticColors = ['success', 'warning', 'error'];
		semanticColors.forEach(colorName => {
			if (colors[colorName]) {
				const backgroundRatio = this.calculateContrastRatio(colors.background, colors[colorName]);
				const textRatio = this.calculateContrastRatio(colors.text, colors[colorName]);
				
				if (backgroundRatio < 3 && textRatio < 3) {
					warnings.push({
						path: `theme.global.colors.${colorName}`,
						message: `${colorName} color may not be distinguishable from background and text`,
						suggestion: 'Ensure semantic meaning is conveyed through more than color alone'
					});
				}
			}
		});
	}

	private validatePerformance(theme: any, warnings: ValidationWarning[]) {
		// Check for overly complex theme structures
		const stringified = JSON.stringify(theme);
		if (stringified.length > 100000) { // 100KB
			warnings.push({
				path: 'theme',
				message: `Theme configuration is ${(stringified.length / 1024).toFixed(1)}KB, which may impact performance`,
				suggestion: 'Consider reducing theme complexity or splitting into multiple files'
			});
		}

		// Check for excessive nesting
		const maxDepth = this.getMaxDepth(theme);
		if (maxDepth > 10) {
			warnings.push({
				path: 'theme',
				message: `Theme nesting depth is ${maxDepth}, which may impact performance`,
				suggestion: 'Consider flattening theme structure'
			});
		}

		// Check for excessive spacing scale
		if (theme.global?.spacing?.scale && theme.global.spacing.scale.length > 20) {
			warnings.push({
				path: 'theme.global.spacing.scale',
				message: `Spacing scale has ${theme.global.spacing.scale.length} values, which may generate excessive CSS`,
				suggestion: 'Consider reducing spacing scale to essential values'
			});
		}
	}

	private validateBrowserCompatibility(theme: any, warnings: ValidationWarning[]) {
		// Check for CSS features that might not be widely supported
		if (theme.global?.colors) {
			Object.entries(theme.global.colors).forEach(([key, value]) => {
				if (typeof value === 'string') {
					// Check for modern CSS color functions
					if (value.includes('oklch') || value.includes('oklab')) {
						warnings.push({
							path: `theme.global.colors.${key}`,
							message: `Color value "${value}" uses modern CSS syntax with limited browser support`,
							suggestion: 'Consider using hex, rgb, or hsl values for better compatibility'
						});
					}
					
					// Check for CSS custom properties in color values
					if (value.includes('var(')) {
						warnings.push({
							path: `theme.global.colors.${key}`,
							message: `Color value "${value}" uses CSS custom properties, ensure fallbacks are provided`,
							suggestion: 'Provide fallback color values for older browsers'
						});
					}
				}
			});
		}

		// Check for modern CSS units
		const modernUnits = ['dvh', 'lvh', 'svh', 'dvw', 'lvw', 'svw'];
		const checkUnits = (obj: any, path: string) => {
			Object.entries(obj).forEach(([key, value]) => {
				if (typeof value === 'string') {
					modernUnits.forEach(unit => {
						if (value.includes(unit)) {
							warnings.push({
								path: `${path}.${key}`,
								message: `Value "${value}" uses modern CSS unit "${unit}" with limited browser support`,
								suggestion: 'Consider using standard units (px, em, rem, %) for better compatibility'
							});
						}
					});
				} else if (typeof value === 'object' && value !== null) {
					checkUnits(value, `${path}.${key}`);
				}
			});
		};

		if (theme.global) {
			checkUnits(theme.global, 'theme.global');
		}
	}

	private calculateContrastRatio(color1: string, color2: string): number {
		// Simplified contrast ratio calculation
		// In a real implementation, you'd use a proper color library
		const rgb1 = this.hexToRgb(color1);
		const rgb2 = this.hexToRgb(color2);
		
		if (!rgb1 || !rgb2) return 1; // Invalid colors

		const l1 = this.getLuminance(rgb1);
		const l2 = this.getLuminance(rgb2);
		
		const lighter = Math.max(l1, l2);
		const darker = Math.min(l1, l2);
		
		return (lighter + 0.05) / (darker + 0.05);
	}

	private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	private getLuminance(rgb: { r: number; g: number; b: number }): number {
		const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
			c = c / 255;
			return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		});
		
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	private getMaxDepth(obj: any, currentDepth = 0): number {
		if (typeof obj !== 'object' || obj === null) {
			return currentDepth;
		}

		let maxDepth = currentDepth;
		Object.values(obj).forEach(value => {
			const depth = this.getMaxDepth(value, currentDepth + 1);
			maxDepth = Math.max(maxDepth, depth);
		});

		return maxDepth;
	}

	// Utility method to sanitize invalid values
	sanitizeTheme(theme: any): AppTheme {
		// This would implement logic to fix common validation errors
		// For now, return a safe default
		try {
			const result = this.validate(theme);
			if (result.valid) {
				return theme as AppTheme;
			}
			
			// Apply fixes for common errors
			const sanitized = JSON.parse(JSON.stringify(theme));
			
			// Fix invalid colors
			if (sanitized.theme?.global?.colors) {
				Object.keys(sanitized.theme.global.colors).forEach(key => {
					const color = sanitized.theme.global.colors[key];
					if (!this.isValidColor(color)) {
						// Use a safe default color
						sanitized.theme.global.colors[key] = '#808080';
					}
				});
			}
			
			return sanitized as AppTheme;
		} catch (error) {
			// Return minimal safe theme if all else fails
			return {
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
		}
	}

	private isValidColor(color: string): boolean {
		if (typeof color !== 'string') return false;
		
		// Check hex colors
		const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		return hexRegex.test(color);
	}
}

export const themeValidator = new ThemeValidator();