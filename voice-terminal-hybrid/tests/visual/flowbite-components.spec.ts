import { test, expect } from '@playwright/test';

test.describe('Flowbite Component Theming', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/component-showcase');
		await page.waitForSelector('[data-testid="components-loaded"]', { timeout: 10000 });
	});

	test('Button component variations', async ({ page }) => {
		const themes = ['default', 'ocean', 'forest'];
		
		for (const theme of themes) {
			await page.evaluate((themeName) => {
				const themeStore = (window as any).__themeStore;
				if (themeStore) {
					themeStore.setPreset(themeName);
				}
			}, theme);

			await page.waitForTimeout(200);

			// Test different button variants
			const buttonVariants = [
				'primary',
				'secondary', 
				'success',
				'warning',
				'error'
			];

			for (const variant of buttonVariants) {
				const button = page.locator(`[data-testid="button-${variant}"]`);
				if (await button.isVisible()) {
					await expect(button).toHaveScreenshot(`button-${variant}-${theme}.png`);
				}
			}
		}
	});

	test('Form component theming', async ({ page }) => {
		const formElements = [
			'input-text',
			'input-password',
			'textarea',
			'select',
			'checkbox',
			'radio',
			'toggle'
		];

		for (const element of formElements) {
			const component = page.locator(`[data-testid="${element}"]`);
			if (await component.isVisible()) {
				// Default state
				await expect(component).toHaveScreenshot(`${element}-default.png`);
				
				// Focus state
				await component.focus();
				await expect(component).toHaveScreenshot(`${element}-focus.png`);
				
				// Error state if applicable
				await component.evaluate((el) => {
					el.classList.add('error');
				});
				await expect(component).toHaveScreenshot(`${element}-error.png`);
			}
		}
	});

	test('Navigation component theming', async ({ page }) => {
		const navbar = page.locator('[data-testid="navbar"]');
		if (await navbar.isVisible()) {
			await expect(navbar).toHaveScreenshot('navbar-default.png');
		}

		const sidebar = page.locator('[data-testid="sidebar"]');
		if (await sidebar.isVisible()) {
			await expect(sidebar).toHaveScreenshot('sidebar-default.png');
			
			// Test active states
			await page.click('[data-testid="nav-item-active"]');
			await expect(sidebar).toHaveScreenshot('sidebar-active-item.png');
		}

		const breadcrumb = page.locator('[data-testid="breadcrumb"]');
		if (await breadcrumb.isVisible()) {
			await expect(breadcrumb).toHaveScreenshot('breadcrumb-default.png');
		}
	});

	test('Feedback component theming', async ({ page }) => {
		// Test toast notifications
		await page.click('[data-testid="show-toast-success"]');
		await page.waitForSelector('[data-testid="toast-success"]');
		await expect(page.locator('[data-testid="toast-success"]')).toHaveScreenshot('toast-success.png');

		await page.click('[data-testid="show-toast-error"]');
		await page.waitForSelector('[data-testid="toast-error"]');
		await expect(page.locator('[data-testid="toast-error"]')).toHaveScreenshot('toast-error.png');

		// Test modal
		await page.click('[data-testid="show-modal"]');
		await page.waitForSelector('[data-testid="modal"]');
		await expect(page.locator('[data-testid="modal"]')).toHaveScreenshot('modal-default.png');

		// Test alert
		const alert = page.locator('[data-testid="alert"]');
		if (await alert.isVisible()) {
			await expect(alert).toHaveScreenshot('alert-default.png');
		}
	});

	test('Data display component theming', async ({ page }) => {
		const card = page.locator('[data-testid="card"]');
		if (await card.isVisible()) {
			await expect(card).toHaveScreenshot('card-default.png');
		}

		const badge = page.locator('[data-testid="badge"]');
		if (await badge.isVisible()) {
			await expect(badge).toHaveScreenshot('badge-default.png');
		}

		const table = page.locator('[data-testid="table"]');
		if (await table.isVisible()) {
			await expect(table).toHaveScreenshot('table-default.png');
		}

		const list = page.locator('[data-testid="list"]');
		if (await list.isVisible()) {
			await expect(list).toHaveScreenshot('list-default.png');
		}
	});

	test('Indicator component theming', async ({ page }) => {
		const progress = page.locator('[data-testid="progress"]');
		if (await progress.isVisible()) {
			await expect(progress).toHaveScreenshot('progress-default.png');
		}

		const spinner = page.locator('[data-testid="spinner"]');
		if (await spinner.isVisible()) {
			await expect(spinner).toHaveScreenshot('spinner-default.png');
		}

		const avatar = page.locator('[data-testid="avatar"]');
		if (await avatar.isVisible()) {
			await expect(avatar).toHaveScreenshot('avatar-default.png');
		}

		const rating = page.locator('[data-testid="rating"]');
		if (await rating.isVisible()) {
			await expect(rating).toHaveScreenshot('rating-default.png');
		}
	});

	test('Component inheritance behavior', async ({ page }) => {
		// Test components that inherit from global theme
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				// Modify global primary color
				themeStore.setTheme({
					theme: {
						global: {
							colors: {
								primary: '#FF6B35' // Custom orange
							}
						}
					}
				});
			}
		});

		await page.waitForTimeout(200);

		// Check if inheriting components use the new primary color
		const inheritingComponents = [
			'button-primary',
			'link-primary',
			'badge-primary'
		];

		for (const component of inheritingComponents) {
			const element = page.locator(`[data-testid="${component}"]`);
			if (await element.isVisible()) {
				await expect(element).toHaveScreenshot(`${component}-custom-primary.png`);
			}
		}
	});

	test('Component override behavior', async ({ page }) => {
		// Test components with specific overrides
		await page.evaluate(() => {
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				themeStore.setTheme({
					theme: {
						components: {
							terminal: {
								inherit: false,
								background: '#2D1B69', // Custom purple
								color: '#F1C40F' // Custom yellow
							}
						}
					}
				});
			}
		});

		await page.waitForTimeout(200);

		const terminal = page.locator('[data-testid="terminal"]');
		if (await terminal.isVisible()) {
			await expect(terminal).toHaveScreenshot('terminal-custom-override.png');
		}
	});

	test('Dynamic theme switching performance', async ({ page }) => {
		// Rapidly switch between themes to test visual consistency
		const themes = ['default', 'ocean', 'forest'];
		
		for (let i = 0; i < 3; i++) {
			for (const theme of themes) {
				await page.evaluate((themeName) => {
					const themeStore = (window as any).__themeStore;
					if (themeStore) {
						themeStore.setPreset(themeName);
					}
				}, theme);
				
				// Short wait to simulate rapid switching
				await page.waitForTimeout(50);
			}
		}

		// Take final screenshot to ensure no visual artifacts
		await page.waitForTimeout(200);
		await expect(page).toHaveScreenshot('rapid-theme-switching-final.png');
	});
});