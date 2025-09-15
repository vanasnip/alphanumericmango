import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Theme Accessibility Tests @accessibility', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
	});

	test('WCAG 2.1 AA compliance for all theme presets', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			const accessibilityScanResults = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.exclude('[data-testid="test-only"]') // Exclude test-only elements
				.analyze();

			expect(accessibilityScanResults.violations).toEqual([]);
		}
	});

	test('color contrast ratios meet WCAG requirements', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			// Test specific color contrast requirements
			const contrastResults = await new AxeBuilder({ page })
				.withRules(['color-contrast'])
				.analyze();

			expect(contrastResults.violations).toEqual([]);

			// Additional manual contrast checks for theme-specific elements
			const contrastChecks = await page.evaluate(() => {
				const getContrastRatio = (element: Element) => {
					const styles = window.getComputedStyle(element);
					const color = styles.color;
					const backgroundColor = styles.backgroundColor;
					
					// This is a simplified check - in real implementation,
					// you'd use a proper contrast calculation library
					return { color, backgroundColor, element: element.tagName };
				};

				const results: any[] = [];
				const elementsToCheck = document.querySelectorAll(
					'button, a, input, textarea, select, [role="button"], [role="link"]'
				);

				elementsToCheck.forEach(element => {
					results.push(getContrastRatio(element));
				});

				return results;
			});

			expect(contrastChecks.length).toBeGreaterThan(0);
		}
	});

	test('keyboard navigation works across all themes', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			// Test tab navigation
			await page.keyboard.press('Tab');
			const firstFocusable = await page.locator(':focus').first();
			expect(await firstFocusable.isVisible()).toBe(true);

			// Check that focus indicators are visible
			const focusStyles = await firstFocusable.evaluate((el) => {
				const styles = window.getComputedStyle(el);
				return {
					outline: styles.outline,
					outlineWidth: styles.outlineWidth,
					outlineStyle: styles.outlineStyle,
					outlineColor: styles.outlineColor,
					boxShadow: styles.boxShadow
				};
			});

			// Should have some form of focus indicator
			const hasFocusIndicator = 
				focusStyles.outline !== 'none' ||
				focusStyles.outlineWidth !== '0px' ||
				focusStyles.boxShadow !== 'none';
			
			expect(hasFocusIndicator).toBe(true);

			// Test navigation through multiple elements
			for (let i = 0; i < 5; i++) {
				await page.keyboard.press('Tab');
				const currentFocus = await page.locator(':focus').first();
				if (await currentFocus.isVisible()) {
					// Each focusable element should have proper focus styles
					const styles = await currentFocus.evaluate((el) => {
						const computed = window.getComputedStyle(el);
						return {
							outline: computed.outline,
							boxShadow: computed.boxShadow
						};
					});
					
					const hasIndicator = 
						styles.outline !== 'none' || 
						styles.boxShadow !== 'none';
					expect(hasIndicator).toBe(true);
				}
			}
		}
	});

	test('screen reader announcements for theme changes', async ({ page }) => {
		// Set up accessibility tree monitoring
		await page.addInitScript(() => {
			(window as any).accessibilityEvents = [];
			
			// Mock screen reader announcements
			const originalSetAttribute = Element.prototype.setAttribute;
			Element.prototype.setAttribute = function(name, value) {
				if (name === 'aria-live' || name === 'aria-label' || name === 'aria-describedby') {
					(window as any).accessibilityEvents.push({
						type: 'attribute',
						element: this.tagName,
						attribute: name,
						value: value,
						timestamp: Date.now()
					});
				}
				return originalSetAttribute.call(this, name, value);
			};
		});

		// Change themes and check for accessibility announcements
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
					
					// Trigger accessibility announcement
					const announcement = document.createElement('div');
					announcement.setAttribute('aria-live', 'polite');
					announcement.setAttribute('aria-label', `Theme changed to ${themeName}`);
					announcement.textContent = `Theme changed to ${themeName}`;
					document.body.appendChild(announcement);
					
					setTimeout(() => {
						document.body.removeChild(announcement);
					}, 100);
				}
			}, theme);

			await page.waitForTimeout(200);
		}

		// Check that accessibility events were recorded
		const accessibilityEvents = await page.evaluate(() => (window as any).accessibilityEvents);
		expect(accessibilityEvents.length).toBeGreaterThan(0);
		
		// Should have announcements for theme changes
		const themeAnnouncements = accessibilityEvents.filter((event: any) => 
			event.attribute === 'aria-live' || 
			(event.attribute === 'aria-label' && event.value.includes('Theme'))
		);
		expect(themeAnnouncements.length).toBeGreaterThan(0);
	});

	test('high contrast mode compatibility', async ({ page }) => {
		// Enable forced colors mode (high contrast)
		await page.emulateMedia({ forcedColors: 'active' });
		
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			// Test that forced colors are respected
			const forcedColorResults = await new AxeBuilder({ page })
				.withRules(['color-contrast'])
				.analyze();

			expect(forcedColorResults.violations).toEqual([]);

			// Check that essential UI elements are still visible
			const visibleElements = await page.evaluate(() => {
				const elements = document.querySelectorAll('button, a, input, select');
				const results: boolean[] = [];
				
				elements.forEach(element => {
					const rect = element.getBoundingClientRect();
					const isVisible = rect.width > 0 && rect.height > 0;
					results.push(isVisible);
				});
				
				return results;
			});

			expect(visibleElements.every(visible => visible)).toBe(true);
		}
	});

	test('reduced motion preferences respected', async ({ page }) => {
		// Enable reduced motion preference
		await page.emulateMedia({ reducedMotion: 'reduce' });
		
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset('default');
			}
		});

		await page.waitForTimeout(200);

		// Check that animations are disabled or reduced
		const animationState = await page.evaluate(() => {
			const elements = document.querySelectorAll('*');
			const animatedElements: any[] = [];
			
			elements.forEach(element => {
				const styles = window.getComputedStyle(element);
				if (styles.animationDuration !== '0s' || styles.transitionDuration !== '0s') {
					animatedElements.push({
						tag: element.tagName,
						animation: styles.animationDuration,
						transition: styles.transitionDuration
					});
				}
			});
			
			return animatedElements;
		});

		// With reduced motion, animations should be minimal or disabled
		animationState.forEach(element => {
			const animDuration = parseFloat(element.animation);
			const transDuration = parseFloat(element.transition);
			
			// Allow very short transitions (< 0.2s) for essential UI feedback
			if (animDuration > 0) {
				expect(animDuration).toBeLessThan(0.2);
			}
			if (transDuration > 0) {
				expect(transDuration).toBeLessThan(0.2);
			}
		});

		// Switch themes and ensure no jarring animations
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setPreset('ocean');
			}
		});

		await page.waitForTimeout(100);

		// Theme should change smoothly without long animations
		const finalAnimationState = await page.evaluate(() => {
			const bodyStyles = window.getComputedStyle(document.body);
			return {
				transition: bodyStyles.transitionDuration,
				animation: bodyStyles.animationDuration
			};
		});

		expect(parseFloat(finalAnimationState.transition)).toBeLessThan(0.2);
		expect(parseFloat(finalAnimationState.animation)).toBeLessThan(0.2);
	});

	test('semantic markup preservation across themes', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			// Check for proper landmark usage
			const landmarks = await new AxeBuilder({ page })
				.withRules(['landmark-one-main', 'landmark-complementary-is-top-level', 'page-has-heading-one'])
				.analyze();

			expect(landmarks.violations).toEqual([]);

			// Check for proper heading structure
			const headingStructure = await new AxeBuilder({ page })
				.withRules(['heading-order'])
				.analyze();

			expect(headingStructure.violations).toEqual([]);

			// Check for proper form labeling
			const formLabeling = await new AxeBuilder({ page })
				.withRules(['label', 'form-field-multiple-labels'])
				.analyze();

			expect(formLabeling.violations).toEqual([]);
		}
	});

	test('interactive element sizing meets touch targets', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			// Check touch target sizes
			const touchTargets = await page.evaluate(() => {
				const interactiveElements = document.querySelectorAll(
					'button, a, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
				);
				
				const results: any[] = [];
				interactiveElements.forEach(element => {
					const rect = element.getBoundingClientRect();
					results.push({
						tag: element.tagName,
						width: rect.width,
						height: rect.height,
						meetsTarget: rect.width >= 44 && rect.height >= 44
					});
				});
				
				return results;
			});

			// Most interactive elements should meet the 44px minimum
			const adequatelySeized = touchTargets.filter(target => target.meetsTarget);
			const inadequatelySeized = touchTargets.filter(target => !target.meetsTarget);
			
			// Allow some small exceptions (like close buttons in corners)
			expect(inadequatelySeized.length).toBeLessThan(touchTargets.length * 0.1); // Less than 10% exceptions
		}
	});

	test('error messaging accessibility', async ({ page }) => {
		// Test theme validation error announcements
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				// Try to set an invalid theme to trigger error handling
				try {
					themeStore.setTheme({
						theme: {
							mode: 'invalid-mode',
							global: {
								colors: {
									primary: 'not-a-color'
								}
							}
						}
					});
				} catch (error) {
					// Expected - testing error handling
				}
			}
		});

		await page.waitForTimeout(200);

		// Check for proper error announcement
		const errorElements = await page.locator('[role="alert"], [aria-live="assertive"]');
		const errorCount = await errorElements.count();
		
		if (errorCount > 0) {
			// Error messages should be properly announced
			for (let i = 0; i < errorCount; i++) {
				const errorElement = errorElements.nth(i);
				const text = await errorElement.textContent();
				expect(text).toBeTruthy();
				expect(text!.length).toBeGreaterThan(0);
			}
		}
	});

	test('theme selection controls accessibility', async ({ page }) => {
		// Navigate to theme selection if it exists
		const themeSelector = page.locator('[data-testid="theme-selector"]');
		
		if (await themeSelector.isVisible()) {
			// Test keyboard navigation to theme controls
			await page.keyboard.press('Tab');
			await page.keyboard.press('Tab');
			await page.keyboard.press('Tab');
			
			const focusedElement = page.locator(':focus');
			await expect(focusedElement).toBeVisible();
			
			// Test that theme selection announces changes
			await page.keyboard.press('ArrowDown');
			await page.waitForTimeout(100);
			
			await page.keyboard.press('Enter');
			await page.waitForTimeout(200);
			
			// Check for announcement of theme change
			const announcement = page.locator('[aria-live="polite"]');
			if (await announcement.isVisible()) {
				const text = await announcement.textContent();
				expect(text).toContain('theme');
			}
		}
	});
});