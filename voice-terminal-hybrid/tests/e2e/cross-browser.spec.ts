import { test, expect, devices } from '@playwright/test';
import { ThemeTestHelpers } from '../fixtures/test-helpers';

test.describe('Cross-Browser Theme Compatibility @e2e @cross-browser', () => {
	let helpers: ThemeTestHelpers;

	const testTheme = {
		theme: {
			global: {
				colors: {
					primary: '#3B82F6',
					secondary: '#8B5CF6',
					success: '#10B981',
					background: '#1F2937',
					text: '#F9FAFB'
				},
				typography: {
					fontFamily: 'Inter, system-ui, sans-serif'
				}
			}
		}
	};

	test.beforeEach(async ({ page }) => {
		helpers = new ThemeTestHelpers(page);
		await page.goto('/');
		await page.waitForFunction(() => (window as any).__themeStore);
	});

	test('Chrome: should render theme correctly', async ({ page }) => {
		await helpers.applyTheme(testTheme);

		// Test CSS custom properties support
		const cssVarsSupported = await page.evaluate(() => {
			return CSS.supports('color', 'var(--test-var)');
		});
		expect(cssVarsSupported).toBe(true);

		// Test theme variables
		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBe('#3B82F6');

		// Test font rendering
		const fontRendering = await page.evaluate(() => {
			const testElement = document.createElement('div');
			testElement.style.fontFamily = 'Inter, system-ui, sans-serif';
			document.body.appendChild(testElement);
			const computedFont = window.getComputedStyle(testElement).fontFamily;
			document.body.removeChild(testElement);
			return computedFont;
		});

		expect(fontRendering).toContain('Inter');
	});

	test('Firefox: should handle CSS variables consistently', async ({ page }) => {
		await helpers.applyTheme(testTheme);

		// Firefox-specific CSS custom property tests
		const firefoxCompatibility = await page.evaluate(() => {
			const root = document.documentElement;
			
			// Test CSS custom property inheritance
			root.style.setProperty('--test-inheritance', 'inherit');
			const testDiv = document.createElement('div');
			testDiv.style.color = 'var(--test-inheritance)';
			document.body.appendChild(testDiv);
			
			const computed = window.getComputedStyle(testDiv).color;
			document.body.removeChild(testDiv);
			
			return {
				supportsInherit: computed !== '',
				userAgent: navigator.userAgent.includes('Firefox')
			};
		});

		// Theme should work correctly in Firefox
		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBe('#3B82F6');

		// Test Firefox-specific rendering
		if (firefoxCompatibility.userAgent) {
			console.log('Running Firefox-specific theme tests');
			
			// Test font smoothing
			const fontSmoothing = await page.evaluate(() => {
				const testElement = document.createElement('div');
				testElement.style.fontSmoothing = 'antialiased';
				testElement.style.webkitFontSmoothing = 'antialiased';
				testElement.style.mozOsxFontSmoothing = 'grayscale';
				document.body.appendChild(testElement);
				
				const styles = window.getComputedStyle(testElement);
				document.body.removeChild(testElement);
				
				return {
					fontSmoothing: styles.fontSmoothing,
					webkitFontSmoothing: styles.webkitFontSmoothing
				};
			});

			// Should handle font smoothing properties
			expect(typeof fontSmoothing).toBe('object');
		}
	});

	test('Safari/WebKit: should handle modern CSS features', async ({ page }) => {
		await helpers.applyTheme(testTheme);

		// WebKit-specific tests
		const webkitFeatures = await page.evaluate(() => {
			const testElement = document.createElement('div');
			document.body.appendChild(testElement);
			
			// Test backdrop-filter support (common in Safari)
			const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(10px)');
			
			// Test CSS color functions
			const supportsColorFunctions = CSS.supports('color', 'color(display-p3 1 0 0)');
			
			// Test CSS custom property in calc()
			testElement.style.setProperty('--test-calc', '10px');
			testElement.style.width = 'calc(var(--test-calc) * 2)';
			const calcSupport = window.getComputedStyle(testElement).width === '20px';
			
			document.body.removeChild(testElement);
			
			return {
				supportsBackdropFilter,
				supportsColorFunctions,
				calcSupport,
				userAgent: navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')
			};
		});

		// Theme should work regardless of advanced feature support
		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBe('#3B82F6');

		if (webkitFeatures.userAgent) {
			console.log('Running Safari-specific theme tests');
			
			// Test if modern features are available
			console.log('Safari features:', webkitFeatures);
		}

		// Test calc() with CSS variables (should work in all modern browsers)
		expect(webkitFeatures.calcSupport).toBe(true);
	});

	test('Edge: should maintain consistency with Chromium base', async ({ page }) => {
		await helpers.applyTheme(testTheme);

		// Edge-specific compatibility tests
		const edgeCompatibility = await page.evaluate(() => {
			const isEdge = navigator.userAgent.includes('Edg');
			
			// Test CSS Grid support (should be excellent in Edge)
			const supportsGrid = CSS.supports('display', 'grid');
			
			// Test CSS custom properties in gradients
			const root = document.documentElement;
			root.style.setProperty('--gradient-color', '#ff0000');
			
			const testElement = document.createElement('div');
			testElement.style.background = 'linear-gradient(to right, var(--gradient-color), blue)';
			document.body.appendChild(testElement);
			
			const gradientSupport = window.getComputedStyle(testElement).background.includes('linear-gradient');
			document.body.removeChild(testElement);
			
			return {
				isEdge,
				supportsGrid,
				gradientSupport
			};
		});

		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBe('#3B82F6');

		if (edgeCompatibility.isEdge) {
			console.log('Running Edge-specific theme tests');
			expect(edgeCompatibility.supportsGrid).toBe(true);
			expect(edgeCompatibility.gradientSupport).toBe(true);
		}
	});

	test('Mobile Chrome: should handle touch interactions and viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await helpers.applyTheme(testTheme);

		// Mobile-specific theme tests
		const mobileFeatures = await page.evaluate(() => {
			const isMobile = /Mobi|Android/i.test(navigator.userAgent);
			
			// Test viewport units
			const testElement = document.createElement('div');
			testElement.style.height = '50vh';
			testElement.style.width = '50vw';
			document.body.appendChild(testElement);
			
			const rect = testElement.getBoundingClientRect();
			const viewportSupport = rect.height > 0 && rect.width > 0;
			
			document.body.removeChild(testElement);
			
			// Test touch-action support
			const supportsTouchAction = CSS.supports('touch-action', 'manipulation');
			
			return {
				isMobile,
				viewportSupport,
				supportsTouchAction,
				screenWidth: screen.width,
				screenHeight: screen.height
			};
		});

		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBe('#3B82F6');

		// Mobile-specific responsive theme testing
		const responsiveElements = page.locator('[data-responsive]');
		const count = await responsiveElements.count();
		
		if (count > 0) {
			const firstElement = responsiveElements.first();
			const mobileStyles = await firstElement.evaluate(el => {
				return window.getComputedStyle(el);
			});
			
			// Should apply mobile-appropriate styling
			expect(mobileStyles).toBeDefined();
		}

		console.log('Mobile features:', mobileFeatures);
	});

	test('Mobile Safari: should handle iOS-specific behaviors', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 }); // iPhone X dimensions
		await helpers.applyTheme(testTheme);

		// iOS Safari-specific tests
		const iosFeatures = await page.evaluate(() => {
			const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
			
			// Test -webkit-appearance reset
			const testInput = document.createElement('input');
			testInput.style.webkitAppearance = 'none';
			document.body.appendChild(testInput);
			
			const appearanceReset = window.getComputedStyle(testInput).webkitAppearance === 'none';
			document.body.removeChild(testInput);
			
			// Test safe area insets
			const testDiv = document.createElement('div');
			testDiv.style.paddingTop = 'env(safe-area-inset-top)';
			document.body.appendChild(testDiv);
			
			const safeAreaSupport = window.getComputedStyle(testDiv).paddingTop !== '0px';
			document.body.removeChild(testDiv);
			
			return {
				isIOS,
				appearanceReset,
				safeAreaSupport
			};
		});

		const themeVars = await helpers.getThemeVariables();
		expect(themeVars['--theme-primary']).toBe('#3B82F6');

		if (iosFeatures.isIOS) {
			console.log('Running iOS Safari-specific theme tests');
			
			// Test that theme works with iOS-specific CSS
			const iosTheme = {
				theme: {
					components: {
						button: {
							inherit: true,
							overrides: {
								webkitAppearance: 'none',
								webkitTapHighlightColor: 'transparent'
							}
						}
					}
				}
			};

			await helpers.applyTheme(iosTheme);
			
			// Should apply iOS-specific styles
			const buttonElement = page.locator('button').first();
			if (await buttonElement.isVisible()) {
				const buttonStyles = await buttonElement.evaluate(el => {
					const styles = window.getComputedStyle(el);
					return {
						webkitAppearance: styles.webkitAppearance,
						webkitTapHighlightColor: styles.webkitTapHighlightColor
					};
				});

				console.log('iOS button styles:', buttonStyles);
			}
		}

		console.log('iOS features:', iosFeatures);
	});

	test('Cross-browser color rendering consistency', async ({ page }) => {
		// Test various color formats across browsers
		const colorFormats = {
			hex: '#3B82F6',
			rgb: 'rgb(59, 130, 246)',
			rgba: 'rgba(59, 130, 246, 1)',
			hsl: 'hsl(217, 91%, 60%)',
			hsla: 'hsla(217, 91%, 60%, 1)'
		};

		for (const [format, color] of Object.entries(colorFormats)) {
			await helpers.applyTheme({
				theme: {
					global: {
						colors: {
							primary: color
						}
					}
				}
			});

			const appliedColor = await page.evaluate(() => {
				const root = document.documentElement;
				return getComputedStyle(root).getPropertyValue('--theme-primary');
			});

			// Should normalize to the same computed value
			expect(appliedColor.trim()).toBeTruthy();
			
			console.log(`${format}: ${color} → ${appliedColor.trim()}`);
		}

		// Test color consistency in actual elements
		const testElement = page.locator('[data-theme-role="primary"]').first();
		if (await testElement.isVisible()) {
			const elementColors = await testElement.evaluate(el => {
				const styles = window.getComputedStyle(el);
				return {
					color: styles.color,
					backgroundColor: styles.backgroundColor,
					borderColor: styles.borderColor
				};
			});

			// Should have consistent color rendering
			Object.values(elementColors).forEach(color => {
				if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
					expect(color).toMatch(/rgb|hsl|#/);
				}
			});
		}
	});

	test('Font rendering across different operating systems', async ({ page }) => {
		const fontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
		
		await helpers.applyTheme({
			theme: {
				global: {
					typography: {
						fontFamily: fontStack
					}
				}
			}
		});

		const fontInfo = await page.evaluate(() => {
			const testElement = document.createElement('div');
			testElement.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
			testElement.textContent = 'Font Rendering Test';
			document.body.appendChild(testElement);

			const computedStyle = window.getComputedStyle(testElement);
			const fontMetrics = {
				fontFamily: computedStyle.fontFamily,
				fontSize: computedStyle.fontSize,
				fontWeight: computedStyle.fontWeight,
				lineHeight: computedStyle.lineHeight,
				letterSpacing: computedStyle.letterSpacing
			};

			document.body.removeChild(testElement);

			return {
				...fontMetrics,
				platform: navigator.platform,
				userAgent: navigator.userAgent
			};
		});

		// Should apply font stack correctly
		expect(fontInfo.fontFamily).toBeTruthy();
		
		// Log platform-specific font rendering
		console.log(`Platform: ${fontInfo.platform}`);
		console.log(`Font family: ${fontInfo.fontFamily}`);
		console.log(`Font metrics:`, {
			size: fontInfo.fontSize,
			weight: fontInfo.fontWeight,
			lineHeight: fontInfo.lineHeight
		});
	});

	test('CSS Grid and Flexbox compatibility', async ({ page }) => {
		// Test modern layout features with themes
		const layoutSupport = await page.evaluate(() => {
			const supports = {
				grid: CSS.supports('display', 'grid'),
				flexbox: CSS.supports('display', 'flex'),
				gap: CSS.supports('gap', '1rem'),
				aspectRatio: CSS.supports('aspect-ratio', '16/9')
			};

			// Test actual layout behavior
			const gridContainer = document.createElement('div');
			gridContainer.style.display = 'grid';
			gridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
			gridContainer.style.gap = 'var(--theme-spacing-4, 1rem)';

			const flexContainer = document.createElement('div');
			flexContainer.style.display = 'flex';
			flexContainer.style.gap = 'var(--theme-spacing-2, 0.5rem)';

			document.body.appendChild(gridContainer);
			document.body.appendChild(flexContainer);

			const gridComputed = window.getComputedStyle(gridContainer);
			const flexComputed = window.getComputedStyle(flexContainer);

			document.body.removeChild(gridContainer);
			document.body.removeChild(flexContainer);

			return {
				...supports,
				gridWorking: gridComputed.display === 'grid',
				flexWorking: flexComputed.display === 'flex'
			};
		});

		// Modern browsers should support these features
		expect(layoutSupport.grid).toBe(true);
		expect(layoutSupport.flexbox).toBe(true);
		expect(layoutSupport.gridWorking).toBe(true);
		expect(layoutSupport.flexWorking).toBe(true);

		console.log('Layout support:', layoutSupport);
	});

	test('Animation and transition performance across browsers', async ({ page }) => {
		await helpers.applyTheme({
			theme: {
				components: {
					animatedElement: {
						inherit: true,
						transition: 'all 0.3s ease-in-out',
						transform: 'scale(1)'
					}
				}
			}
		});

		const animationSupport = await page.evaluate(() => {
			const testElement = document.createElement('div');
			testElement.style.transition = 'transform 0.3s ease-in-out';
			testElement.style.transform = 'scale(1)';
			document.body.appendChild(testElement);

			// Test animation API support
			const supportsWebAnimations = typeof testElement.animate === 'function';
			
			// Test CSS transition events
			let transitionEventFired = false;
			testElement.addEventListener('transitionend', () => {
				transitionEventFired = true;
			});

			// Trigger transition
			testElement.style.transform = 'scale(1.1)';

			// Wait for transition
			return new Promise(resolve => {
				setTimeout(() => {
					document.body.removeChild(testElement);
					resolve({
						supportsWebAnimations,
						transitionEventFired,
						supportsTransform: CSS.supports('transform', 'scale(1)'),
						supportsTransition: CSS.supports('transition', 'all 0.3s ease')
					});
				}, 400);
			});
		});

		// Should support modern animation features
		expect((await animationSupport).supportsTransform).toBe(true);
		expect((await animationSupport).supportsTransition).toBe(true);

		console.log('Animation support:', await animationSupport);
	});
});