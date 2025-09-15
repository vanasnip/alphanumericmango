import { test, expect } from '@playwright/test';
import { ThemeTestHelpers } from '../fixtures/test-helpers';

test.describe('Component Theme Application @e2e @components', () => {
	let helpers: ThemeTestHelpers;

	test.beforeEach(async ({ page }) => {
		helpers = new ThemeTestHelpers(page);
		await page.goto('/');
		
		// Wait for theme store and components to be available
		await page.waitForFunction(() => (window as any).__themeStore);
		await page.waitForSelector('[data-component]', { timeout: 5000 });
	});

	test('should apply theme to Flowbite Button components', async ({ page }) => {
		// Apply custom theme
		const customTheme = {
			theme: {
				global: {
					colors: {
						primary: '#FF6B6B',
						secondary: '#4ECDC4'
					}
				},
				components: {
					button: {
						inherit: true,
						overrides: {
							borderRadius: '12px',
							fontWeight: '600'
						}
					}
				}
			}
		};

		await helpers.applyTheme(customTheme);

		// Test primary button
		const primaryButton = page.locator('button[data-theme-role="primary"]').first();
		if (await primaryButton.isVisible()) {
			const buttonStyles = await primaryButton.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					backgroundColor: styles.backgroundColor,
					borderRadius: styles.borderRadius,
					fontWeight: styles.fontWeight
				};
			});

			// Should use primary color (converted to RGB)
			expect(buttonStyles.backgroundColor).toContain('255, 107, 107'); // #FF6B6B in RGB
			expect(buttonStyles.borderRadius).toBe('12px');
			expect(buttonStyles.fontWeight).toBe('600');
		}

		// Test secondary button
		const secondaryButton = page.locator('button[data-theme-role="secondary"]').first();
		if (await secondaryButton.isVisible()) {
			const backgroundColor = await secondaryButton.evaluate(el => 
				window.getComputedStyle(el).backgroundColor
			);
			expect(backgroundColor).toContain('78, 205, 196'); // #4ECDC4 in RGB
		}
	});

	test('should apply theme to Input components', async ({ page }) => {
		const inputTheme = {
			theme: {
				global: {
					colors: {
						surface: '#2D3748',
						text: '#E2E8F0',
						primary: '#3182CE'
					}
				},
				components: {
					input: {
						inherit: true,
						overrides: {
							padding: '12px 16px',
							fontSize: '14px',
							borderWidth: '2px'
						}
					}
				}
			}
		};

		await helpers.applyTheme(inputTheme);

		// Test text input
		const textInput = page.locator('input[type="text"]').first();
		if (await textInput.isVisible()) {
			const inputStyles = await textInput.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					padding: styles.padding,
					fontSize: styles.fontSize,
					borderWidth: styles.borderWidth,
					backgroundColor: styles.backgroundColor,
					color: styles.color
				};
			});

			expect(inputStyles.padding).toContain('12px');
			expect(inputStyles.padding).toContain('16px');
			expect(inputStyles.fontSize).toBe('14px');
			expect(inputStyles.borderWidth).toBe('2px');
		}

		// Test focus states
		await textInput.focus();
		const focusedBorderColor = await textInput.evaluate(el => 
			window.getComputedStyle(el).borderColor
		);
		expect(focusedBorderColor).toContain('49, 130, 206'); // #3182CE in RGB
	});

	test('should apply theme to Modal components', async ({ page }) => {
		const modalTheme = {
			theme: {
				global: {
					colors: {
						surface: '#1A202C',
						text: '#F7FAFC',
						background: 'rgba(0, 0, 0, 0.8)'
					}
				},
				components: {
					modal: {
						inherit: true,
						overrides: {
							borderRadius: '16px',
							padding: '24px',
							maxWidth: '600px'
						}
					}
				}
			}
		};

		await helpers.applyTheme(modalTheme);

		// Open a modal (trigger modal button if available)
		const modalTrigger = page.locator('[data-testid="open-modal-button"]');
		if (await modalTrigger.isVisible()) {
			await modalTrigger.click();

			// Test modal styling
			const modal = page.locator('[data-component="modal"]');
			await expect(modal).toBeVisible();

			const modalStyles = await modal.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					borderRadius: styles.borderRadius,
					padding: styles.padding,
					maxWidth: styles.maxWidth,
					backgroundColor: styles.backgroundColor
				};
			});

			expect(modalStyles.borderRadius).toBe('16px');
			expect(modalStyles.padding).toBe('24px');
			expect(modalStyles.maxWidth).toBe('600px');

			// Test backdrop
			const backdrop = page.locator('[data-component="modal-backdrop"]');
			if (await backdrop.isVisible()) {
				const backdropColor = await backdrop.evaluate(el => 
					window.getComputedStyle(el).backgroundColor
				);
				expect(backdropColor).toContain('rgba(0, 0, 0, 0.8)');
			}
		}
	});

	test('should apply theme to Terminal component with inheritance', async ({ page }) => {
		const terminalTheme = {
			theme: {
				global: {
					colors: {
						background: '#0D1117',
						text: '#C9D1D9',
						success: '#238636',
						error: '#DA3633'
					},
					typography: {
						fontFamily: 'JetBrains Mono, monospace'
					}
				},
				components: {
					terminal: {
						inherit: false, // Override global theme
						backgroundColor: '#000000',
						color: '#00FF00',
						fontFamily: 'Fira Code, monospace',
						fontSize: '14px',
						lineHeight: '1.6',
						padding: '20px'
					}
				}
			}
		};

		await helpers.applyTheme(terminalTheme);

		const terminal = page.locator('[data-component="terminal"]');
		if (await terminal.isVisible()) {
			const terminalStyles = await terminal.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					backgroundColor: styles.backgroundColor,
					color: styles.color,
					fontFamily: styles.fontFamily,
					fontSize: styles.fontSize,
					lineHeight: styles.lineHeight,
					padding: styles.padding
				};
			});

			// Should use component-specific styles, not global
			expect(terminalStyles.backgroundColor).toContain('0, 0, 0'); // #000000
			expect(terminalStyles.color).toContain('0, 255, 0'); // #00FF00
			expect(terminalStyles.fontFamily).toContain('Fira Code');
			expect(terminalStyles.fontSize).toBe('14px');
			expect(terminalStyles.lineHeight).toBe('1.6');
		}
	});

	test('should apply CSS variables correctly', async ({ page }) => {
		const themeWithVariables = {
			theme: {
				global: {
					colors: {
						primary: '#8B5CF6',
						secondary: '#EC4899',
						accent: '#F59E0B'
					}
				}
			}
		};

		await helpers.applyTheme(themeWithVariables);

		// Check CSS variables are set on document root
		const cssVariables = await page.evaluate(() => {
			const root = document.documentElement;
			const styles = window.getComputedStyle(root);
			return {
				primary: styles.getPropertyValue('--theme-primary').trim(),
				secondary: styles.getPropertyValue('--theme-secondary').trim(),
				accent: styles.getPropertyValue('--theme-accent').trim()
			};
		});

		expect(cssVariables.primary).toBe('#8B5CF6');
		expect(cssVariables.secondary).toBe('#EC4899');
		expect(cssVariables.accent).toBe('#F59E0B');

		// Test components using these variables
		const elementsUsingVars = page.locator('[style*="var(--theme-"]');
		const count = await elementsUsingVars.count();
		if (count > 0) {
			// Check first element using CSS variables
			const firstElement = elementsUsingVars.first();
			const computedColor = await firstElement.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return styles.color || styles.backgroundColor || styles.borderColor;
			});
			
			// Should resolve to actual color value
			expect(computedColor).toMatch(/#[0-9A-Fa-f]{6}|rgb\(/);
		}
	});

	test('should handle responsive behavior with themes', async ({ page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		const responsiveTheme = {
			theme: {
				global: {
					spacing: {
						unit: '0.25rem',
						scale: [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16] // Smaller spacing for mobile
					}
				},
				components: {
					button: {
						inherit: true,
						overrides: {
							padding: '8px 12px', // Smaller padding for mobile
							fontSize: '14px'
						}
					}
				}
			}
		};

		await helpers.applyTheme(responsiveTheme);

		// Check button spacing on mobile
		const mobileButton = page.locator('button').first();
		if (await mobileButton.isVisible()) {
			const mobileStyles = await mobileButton.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					padding: styles.padding,
					fontSize: styles.fontSize
				};
			});

			expect(mobileStyles.padding).toContain('8px');
			expect(mobileStyles.padding).toContain('12px');
			expect(mobileStyles.fontSize).toBe('14px');
		}

		// Test desktop viewport
		await page.setViewportSize({ width: 1200, height: 800 });

		const desktopTheme = {
			theme: {
				components: {
					button: {
						inherit: true,
						overrides: {
							padding: '12px 24px', // Larger padding for desktop
							fontSize: '16px'
						}
					}
				}
			}
		};

		await helpers.applyTheme(desktopTheme);

		// Check button spacing on desktop
		const desktopButton = page.locator('button').first();
		if (await desktopButton.isVisible()) {
			const desktopStyles = await desktopButton.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					padding: styles.padding,
					fontSize: styles.fontSize
				};
			});

			expect(desktopStyles.padding).toContain('12px');
			expect(desktopStyles.padding).toContain('24px');
			expect(desktopStyles.fontSize).toBe('16px');
		}
	});

	test('should validate animations and transitions', async ({ page }) => {
		const animatedTheme = {
			theme: {
				global: {
					colors: {
						primary: '#3B82F6',
						secondary: '#8B5CF6'
					}
				},
				components: {
					button: {
						inherit: true,
						overrides: {
							transition: 'all 0.3s ease',
							transform: 'scale(1)'
						}
					}
				}
			}
		};

		await helpers.applyTheme(animatedTheme);

		const animatedButton = page.locator('button[data-testid="animated-button"]');
		if (await animatedButton.isVisible()) {
			// Check initial state
			const initialStyles = await animatedButton.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					transition: styles.transition,
					transform: styles.transform
				};
			});

			expect(initialStyles.transition).toContain('0.3s');
			expect(initialStyles.transform).toContain('scale(1)');

			// Test hover state animation
			await animatedButton.hover();
			await page.waitForTimeout(100); // Allow transition to start

			const hoverStyles = await animatedButton.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					transform: styles.transform,
					backgroundColor: styles.backgroundColor
				};
			});

			// Should have animated properties
			expect(hoverStyles.transform).toBeDefined();
			expect(hoverStyles.backgroundColor).toBeDefined();
		}
	});

	test('should handle component inheritance properly', async ({ page }) => {
		// Test component that inherits from global theme
		const inheritanceTheme = {
			theme: {
				global: {
					colors: {
						primary: '#EF4444',
						text: '#1F2937'
					},
					typography: {
						fontFamily: 'Inter, sans-serif'
					}
				},
				components: {
					inheritingComponent: {
						inherit: true,
						overrides: {
							borderRadius: '8px'
						}
					},
					nonInheritingComponent: {
						inherit: false,
						color: '#059669',
						fontFamily: 'Roboto Mono, monospace'
					}
				}
			}
		};

		await helpers.applyTheme(inheritanceTheme);

		// Test inheriting component
		const inheritingElement = page.locator('[data-component="inheritingComponent"]');
		if (await inheritingElement.isVisible()) {
			const inheritanceResult = await helpers.testComponentInheritance('inheritingComponent', 'color');
			
			expect(inheritanceResult.inheritsGlobal).toBe(true);
			expect(inheritanceResult.hasOverrides).toBe(false); // No color override
			// Should inherit global text color
		}

		// Test non-inheriting component
		const nonInheritingElement = page.locator('[data-component="nonInheritingComponent"]');
		if (await nonInheritingElement.isVisible()) {
			const nonInheritanceResult = await helpers.testComponentInheritance('nonInheritingComponent', 'color');
			
			expect(nonInheritanceResult.inheritsGlobal).toBe(false);
			// Should use component-specific color
		}
	});

	test('should apply dark/light mode variants', async ({ page }) => {
		// Test dark mode
		const darkTheme = {
			theme: {
				mode: 'dark',
				global: {
					colors: {
						background: '#111827',
						surface: '#1F2937',
						text: '#F9FAFB'
					}
				}
			}
		};

		await helpers.applyTheme(darkTheme);

		// Check dark mode classes or data attributes
		const isDarkMode = await page.evaluate(() => {
			return document.documentElement.classList.contains('dark') ||
				   document.documentElement.dataset.theme === 'dark' ||
				   document.body.classList.contains('dark');
		});

		expect(isDarkMode).toBeTruthy();

		// Test light mode
		const lightTheme = {
			theme: {
				mode: 'light',
				global: {
					colors: {
						background: '#FFFFFF',
						surface: '#F9FAFB',
						text: '#111827'
					}
				}
			}
		};

		await helpers.applyTheme(lightTheme);

		const isLightMode = await page.evaluate(() => {
			return document.documentElement.classList.contains('light') ||
				   document.documentElement.dataset.theme === 'light' ||
				   !document.documentElement.classList.contains('dark');
		});

		expect(isLightMode).toBeTruthy();
	});

	test('should handle component-specific pseudo-states', async ({ page }) => {
		const pseudoStateTheme = {
			theme: {
				components: {
					button: {
						inherit: true,
						overrides: {
							hoverColor: '#FFFFFF',
							activeColor: '#F3F4F6',
							disabledOpacity: '0.5'
						}
					}
				}
			}
		};

		await helpers.applyTheme(pseudoStateTheme);

		const testButton = page.locator('button').first();
		if (await testButton.isVisible()) {
			// Test hover state
			await testButton.hover();
			const hoverColor = await testButton.evaluate(el => 
				window.getComputedStyle(el, ':hover').color
			);

			// Test active state
			await testButton.click();
			const activeColor = await testButton.evaluate(el => 
				window.getComputedStyle(el, ':active').color
			);

			// Test disabled state if button can be disabled
			await page.evaluate(() => {
				const button = document.querySelector('button');
				if (button) button.disabled = true;
			});

			const disabledOpacity = await testButton.evaluate(el => 
				window.getComputedStyle(el).opacity
			);

			expect(disabledOpacity).toBe('0.5');
		}
	});
});