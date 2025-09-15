import { Page, Locator, expect } from '@playwright/test';
import { ThemeTestHelpers } from './test-helpers';
import { VoiceTestHelpers } from './voice-helpers';
import { JSONEditingHelpers } from './json-editing-helpers';

/**
 * Page Object Model patterns for theme testing
 */

export class BasePage {
	constructor(protected page: Page) {}

	/**
	 * Navigate to the page
	 */
	async goto(path = '/'): Promise<void> {
		await this.page.goto(path);
		await this.waitForPageLoad();
	}

	/**
	 * Wait for page to fully load
	 */
	async waitForPageLoad(): Promise<void> {
		await this.page.waitForLoadState('networkidle');
		await this.page.waitForFunction(() => document.readyState === 'complete');
	}

	/**
	 * Wait for theme store to be available
	 */
	async waitForThemeStore(): Promise<void> {
		await this.page.waitForFunction(() => (window as any).__themeStore);
	}

	/**
	 * Get current page URL
	 */
	async getCurrentURL(): Promise<string> {
		return this.page.url();
	}

	/**
	 * Take a screenshot
	 */
	async takeScreenshot(name: string): Promise<Buffer> {
		return await this.page.screenshot({ path: `test-results/${name}.png` });
	}
}

export class ThemeSettingsPage extends BasePage {
	private helpers: ThemeTestHelpers;
	private jsonHelpers: JSONEditingHelpers;

	// Locators
	readonly settingsButton = this.page.locator('[data-testid="theme-settings-button"]');
	readonly settingsModal = this.page.locator('[data-testid="theme-settings-modal"]');
	readonly jsonEditor = this.page.locator('[data-testid="theme-json-editor"]');
	readonly previewArea = this.page.locator('[data-testid="theme-preview"]');
	readonly saveButton = this.page.locator('[data-testid="save-theme-button"]');
	readonly cancelButton = this.page.locator('[data-testid="cancel-theme-button"]');
	readonly resetButton = this.page.locator('[data-testid="reset-theme-button"]');
	readonly validationError = this.page.locator('[data-testid="json-validation-error"]');
	readonly saveSuccessNotification = this.page.locator('[data-testid="save-success-notification"]');

	// Tabs
	readonly themeTab = this.page.locator('[data-testid="settings-tab-theme"]');
	readonly advancedTab = this.page.locator('[data-testid="settings-tab-advanced"]');
	readonly presetsTab = this.page.locator('[data-testid="settings-tab-presets"]');

	// Preset buttons
	readonly defaultPresetButton = this.page.locator('[data-testid="preset-default"]');
	readonly oceanPresetButton = this.page.locator('[data-testid="preset-ocean"]');
	readonly forestPresetButton = this.page.locator('[data-testid="preset-forest"]');

	constructor(page: Page) {
		super(page);
		this.helpers = new ThemeTestHelpers(page);
		this.jsonHelpers = new JSONEditingHelpers(page);
	}

	/**
	 * Open theme settings
	 */
	async open(): Promise<void> {
		await this.settingsButton.click();
		await expect(this.settingsModal).toBeVisible();
	}

	/**
	 * Close theme settings
	 */
	async close(): Promise<void> {
		await this.cancelButton.click();
		await expect(this.settingsModal).not.toBeVisible();
	}

	/**
	 * Switch to a specific tab
	 */
	async switchToTab(tab: 'theme' | 'advanced' | 'presets'): Promise<void> {
		const tabMap = {
			theme: this.themeTab,
			advanced: this.advancedTab,
			presets: this.presetsTab
		};

		await tabMap[tab].click();
		await expect(tabMap[tab]).toHaveClass(/active|selected/);
	}

	/**
	 * Edit JSON theme directly
	 */
	async editJSONTheme(themeData: any): Promise<void> {
		await expect(this.jsonEditor).toBeVisible();
		await this.jsonHelpers.setJSONContent(
			this.jsonHelpers.formatJSON(themeData),
			this.jsonEditor
		);
	}

	/**
	 * Get current JSON theme
	 */
	async getCurrentJSONTheme(): Promise<any> {
		const content = await this.jsonHelpers.getJSONContent(this.jsonEditor);
		return this.jsonHelpers.parseJSON(content).data;
	}

	/**
	 * Apply a preset theme
	 */
	async applyPreset(preset: 'default' | 'ocean' | 'forest'): Promise<void> {
		await this.switchToTab('presets');

		const presetMap = {
			default: this.defaultPresetButton,
			ocean: this.oceanPresetButton,
			forest: this.forestPresetButton
		};

		await presetMap[preset].click();
		await this.waitForPreviewUpdate();
	}

	/**
	 * Save current theme
	 */
	async saveTheme(): Promise<void> {
		await this.saveButton.click();
		await expect(this.saveSuccessNotification).toBeVisible();
	}

	/**
	 * Reset theme to default
	 */
	async resetTheme(): Promise<void> {
		await this.resetButton.click();
		
		// Handle confirmation dialog if present
		const confirmButton = this.page.locator('[data-testid="confirm-reset-button"]');
		if (await confirmButton.isVisible()) {
			await confirmButton.click();
		}

		await this.waitForPreviewUpdate();
	}

	/**
	 * Wait for preview to update
	 */
	async waitForPreviewUpdate(): Promise<void> {
		await this.page.waitForTimeout(300); // Allow for theme application
	}

	/**
	 * Validate current theme
	 */
	async validateTheme(): Promise<{ valid: boolean; errors: string[] }> {
		const validation = await this.jsonHelpers.validateJSONContent(this.jsonEditor);
		
		if (!validation.valid) {
			await expect(this.validationError).toBeVisible();
		}

		return {
			valid: validation.valid,
			errors: validation.errors
		};
	}

	/**
	 * Check if save button is enabled
	 */
	async isSaveEnabled(): Promise<boolean> {
		return await this.saveButton.isEnabled();
	}

	/**
	 * Get preview theme variables
	 */
	async getPreviewThemeVariables(): Promise<Record<string, string>> {
		return await this.helpers.getThemeVariables();
	}
}

export class VoiceControlPage extends BasePage {
	private voiceHelpers: VoiceTestHelpers;

	// Locators
	readonly voiceToggleButton = this.page.locator('[data-testid="voice-toggle-button"]');
	readonly voiceIndicator = this.page.locator('[data-testid="voice-indicator"]');
	readonly voiceFeedback = this.page.locator('[data-testid="voice-feedback"]');
	readonly voiceError = this.page.locator('[data-testid="voice-error"]');
	readonly voiceSettingsButton = this.page.locator('[data-testid="voice-settings-button"]');
	readonly microphonePermissionButton = this.page.locator('[data-testid="microphone-permission-button"]');

	// Voice status classes
	readonly listeningClass = /listening|active/;
	readonly processingClass = /processing|thinking/;
	readonly errorClass = /error|failed/;

	constructor(page: Page) {
		super(page);
		this.voiceHelpers = new VoiceTestHelpers(page);
	}

	/**
	 * Initialize voice mocks for testing
	 */
	async initializeVoiceMocks(): Promise<void> {
		await this.voiceHelpers.initializeVoiceMocks();
	}

	/**
	 * Start voice recognition
	 */
	async startVoiceRecognition(): Promise<void> {
		await this.voiceToggleButton.click();
		await expect(this.voiceIndicator).toHaveClass(this.listeningClass);
	}

	/**
	 * Stop voice recognition
	 */
	async stopVoiceRecognition(): Promise<void> {
		await this.voiceToggleButton.click();
		await expect(this.voiceIndicator).not.toHaveClass(this.listeningClass);
	}

	/**
	 * Send a voice command
	 */
	async sendVoiceCommand(text: string, confidence = 0.9): Promise<void> {
		await this.voiceHelpers.simulateVoiceCommand({ text, confidence });
		await this.waitForCommandProcessing();
	}

	/**
	 * Send multiple voice commands in sequence
	 */
	async sendVoiceSequence(commands: string[], delay = 300): Promise<void> {
		for (const command of commands) {
			await this.sendVoiceCommand(command);
			await this.page.waitForTimeout(delay);
		}
	}

	/**
	 * Wait for command processing to complete
	 */
	async waitForCommandProcessing(): Promise<void> {
		await this.voiceHelpers.waitForVoiceProcessing();
	}

	/**
	 * Check if voice is currently listening
	 */
	async isListening(): Promise<boolean> {
		const classes = await this.voiceIndicator.getAttribute('class');
		return !!(classes && this.listeningClass.test(classes));
	}

	/**
	 * Check if voice is processing
	 */
	async isProcessing(): Promise<boolean> {
		const classes = await this.voiceIndicator.getAttribute('class');
		return !!(classes && this.processingClass.test(classes));
	}

	/**
	 * Check if there's a voice error
	 */
	async hasVoiceError(): Promise<boolean> {
		return await this.voiceError.isVisible();
	}

	/**
	 * Get voice feedback text
	 */
	async getVoiceFeedback(): Promise<string> {
		return await this.voiceFeedback.textContent() || '';
	}

	/**
	 * Get voice error message
	 */
	async getVoiceErrorMessage(): Promise<string> {
		return await this.voiceError.textContent() || '';
	}

	/**
	 * Simulate voice recognition error
	 */
	async simulateVoiceError(error: string, message = ''): Promise<void> {
		await this.voiceHelpers.simulateVoiceError(error, message);
		await expect(this.voiceError).toBeVisible();
	}

	/**
	 * Test theme change via voice
	 */
	async changeThemeViaVoice(theme: string): Promise<void> {
		await this.sendVoiceCommand(`change theme to ${theme}`);
		await this.waitForCommandProcessing();
	}

	/**
	 * Test mode change via voice
	 */
	async changeModeViaVoice(mode: 'dark' | 'light'): Promise<void> {
		await this.sendVoiceCommand(`switch to ${mode} mode`);
		await this.waitForCommandProcessing();
	}

	/**
	 * Request microphone permissions
	 */
	async requestMicrophonePermission(): Promise<void> {
		if (await this.microphonePermissionButton.isVisible()) {
			await this.microphonePermissionButton.click();
		}
	}

	/**
	 * Get voice command history
	 */
	async getCommandHistory(): Promise<Array<{ text: string; confidence?: number }>> {
		return await this.voiceHelpers.getVoiceCommandHistory();
	}

	/**
	 * Clear voice command history
	 */
	async clearCommandHistory(): Promise<void> {
		await this.voiceHelpers.clearVoiceHistory();
	}
}

export class ThemePreviewPage extends BasePage {
	private helpers: ThemeTestHelpers;

	// Component locators
	readonly primaryButton = this.page.locator('button[data-theme-role="primary"]').first();
	readonly secondaryButton = this.page.locator('button[data-theme-role="secondary"]').first();
	readonly successButton = this.page.locator('button[data-theme-role="success"]').first();
	readonly warningButton = this.page.locator('button[data-theme-role="warning"]').first();
	readonly errorButton = this.page.locator('button[data-theme-role="error"]').first();

	readonly textInput = this.page.locator('input[type="text"]').first();
	readonly textArea = this.page.locator('textarea').first();
	readonly selectElement = this.page.locator('select').first();

	readonly modal = this.page.locator('[data-component="modal"]');
	readonly modalTrigger = this.page.locator('[data-testid="open-modal-button"]');
	readonly modalBackdrop = this.page.locator('[data-component="modal-backdrop"]');

	readonly terminal = this.page.locator('[data-component="terminal"]');
	readonly card = this.page.locator('[data-component="card"]').first();
	readonly alert = this.page.locator('[data-component="alert"]').first();

	constructor(page: Page) {
		super(page);
		this.helpers = new ThemeTestHelpers(page);
	}

	/**
	 * Apply a theme and wait for rendering
	 */
	async applyTheme(theme: any): Promise<void> {
		await this.helpers.applyTheme(theme);
		await this.waitForThemeApplication();
	}

	/**
	 * Apply a preset theme
	 */
	async applyPreset(preset: string): Promise<void> {
		await this.helpers.applyPreset(preset);
		await this.waitForThemeApplication();
	}

	/**
	 * Wait for theme to be fully applied
	 */
	async waitForThemeApplication(): Promise<void> {
		await this.page.waitForTimeout(200);
		await this.page.waitForFunction(() => {
			const primaryColor = getComputedStyle(document.documentElement)
				.getPropertyValue('--theme-primary');
			return primaryColor.trim() !== '';
		});
	}

	/**
	 * Get computed styles for an element
	 */
	async getElementStyles(locator: Locator): Promise<Record<string, string>> {
		return await locator.evaluate(el => {
			const styles = window.getComputedStyle(el);
			return {
				backgroundColor: styles.backgroundColor,
				color: styles.color,
				borderColor: styles.borderColor,
				borderRadius: styles.borderRadius,
				fontSize: styles.fontSize,
				fontFamily: styles.fontFamily,
				padding: styles.padding,
				margin: styles.margin
			};
		});
	}

	/**
	 * Test button theme application
	 */
	async testButtonThemes(): Promise<Record<string, Record<string, string>>> {
		const buttons = {
			primary: this.primaryButton,
			secondary: this.secondaryButton,
			success: this.successButton,
			warning: this.warningButton,
			error: this.errorButton
		};

		const results: Record<string, Record<string, string>> = {};

		for (const [role, button] of Object.entries(buttons)) {
			if (await button.isVisible()) {
				results[role] = await this.getElementStyles(button);
			}
		}

		return results;
	}

	/**
	 * Test input element themes
	 */
	async testInputThemes(): Promise<Record<string, Record<string, string>>> {
		const inputs = {
			textInput: this.textInput,
			textArea: this.textArea,
			select: this.selectElement
		};

		const results: Record<string, Record<string, string>> = {};

		for (const [type, input] of Object.entries(inputs)) {
			if (await input.isVisible()) {
				results[type] = await this.getElementStyles(input);
			}
		}

		return results;
	}

	/**
	 * Test modal theme application
	 */
	async testModalTheme(): Promise<{ modal?: Record<string, string>; backdrop?: Record<string, string> }> {
		const results: { modal?: Record<string, string>; backdrop?: Record<string, string> } = {};

		// Open modal if trigger exists
		if (await this.modalTrigger.isVisible()) {
			await this.modalTrigger.click();
			
			if (await this.modal.isVisible()) {
				results.modal = await this.getElementStyles(this.modal);
			}

			if (await this.modalBackdrop.isVisible()) {
				results.backdrop = await this.getElementStyles(this.modalBackdrop);
			}

			// Close modal
			await this.page.keyboard.press('Escape');
		}

		return results;
	}

	/**
	 * Test terminal theme application
	 */
	async testTerminalTheme(): Promise<Record<string, string> | null> {
		if (await this.terminal.isVisible()) {
			return await this.getElementStyles(this.terminal);
		}
		return null;
	}

	/**
	 * Test responsive theme behavior
	 */
	async testResponsiveTheme(viewports: Array<{ width: number; height: number; name: string }>): Promise<Record<string, Record<string, string>>> {
		const results: Record<string, Record<string, string>> = {};

		for (const viewport of viewports) {
			await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
			await this.page.waitForTimeout(100);

			if (await this.primaryButton.isVisible()) {
				results[viewport.name] = await this.getElementStyles(this.primaryButton);
			}
		}

		return results;
	}

	/**
	 * Test component inheritance behavior
	 */
	async testComponentInheritance(componentSelector: string): Promise<{
		inheritsGlobal: boolean;
		hasOverrides: boolean;
		computedStyles: Record<string, string>;
	}> {
		const component = this.page.locator(componentSelector);
		
		if (!(await component.isVisible())) {
			throw new Error(`Component ${componentSelector} not found`);
		}

		const computedStyles = await this.getElementStyles(component);

		// Check inheritance by examining theme variables
		const inheritanceInfo = await this.page.evaluate((selector) => {
			const element = document.querySelector(selector);
			if (!element) return { inheritsGlobal: false, hasOverrides: false };

			const componentName = element.getAttribute('data-component');
			if (!componentName) return { inheritsGlobal: false, hasOverrides: false };

			const themeStore = (window as any).__themeStore;
			if (!themeStore) return { inheritsGlobal: false, hasOverrides: false };

			const theme = themeStore.getTheme();
			const componentConfig = theme?.theme?.components?.[componentName];

			return {
				inheritsGlobal: componentConfig?.inherit || false,
				hasOverrides: !!(componentConfig?.overrides && Object.keys(componentConfig.overrides).length > 0)
			};
		}, componentSelector);

		return {
			...inheritanceInfo,
			computedStyles
		};
	}

	/**
	 * Take a visual regression screenshot
	 */
	async takeVisualSnapshot(name: string): Promise<void> {
		await expect(this.page).toHaveScreenshot(`${name}.png`);
	}

	/**
	 * Test dark/light mode rendering
	 */
	async testModeRendering(): Promise<{ dark: Record<string, string>; light: Record<string, string> }> {
		// Test dark mode
		await this.helpers.setMode('dark');
		await this.waitForThemeApplication();
		const darkStyles = await this.getElementStyles(this.page.locator('body'));

		// Test light mode
		await this.helpers.setMode('light');
		await this.waitForThemeApplication();
		const lightStyles = await this.getElementStyles(this.page.locator('body'));

		return { dark: darkStyles, light: lightStyles };
	}

	/**
	 * Verify accessibility contrast ratios
	 */
	async verifyContrastRatios(minRatio = 4.5): Promise<Array<{ element: string; ratio: number; passes: boolean }>> {
		const textElements = [
			{ selector: 'button', name: 'button' },
			{ selector: 'input', name: 'input' },
			{ selector: 'p', name: 'paragraph' },
			{ selector: 'h1, h2, h3, h4, h5, h6', name: 'heading' }
		];

		const results = [];

		for (const element of textElements) {
			const locator = this.page.locator(element.selector).first();
			
			if (await locator.isVisible()) {
				const styles = await this.getElementStyles(locator);
				const ratio = await this.helpers.calculateContrastRatio(
					styles.backgroundColor || '#ffffff',
					styles.color || '#000000'
				);

				results.push({
					element: element.name,
					ratio,
					passes: ratio >= minRatio
				});
			}
		}

		return results;
	}
}

export class PerformancePage extends BasePage {
	private helpers: ThemeTestHelpers;

	constructor(page: Page) {
		super(page);
		this.helpers = new ThemeTestHelpers(page);
	}

	/**
	 * Measure theme switch performance
	 */
	async measureThemeSwitchPerformance(iterations = 10): Promise<{
		times: number[];
		average: number;
		min: number;
		max: number;
	}> {
		const times: number[] = [];
		const themes = ['default', 'ocean', 'forest'];

		for (let i = 0; i < iterations; i++) {
			const fromTheme = themes[i % themes.length];
			const toTheme = themes[(i + 1) % themes.length];

			const time = await this.helpers.measureThemeSwitchPerformance(fromTheme, toTheme);
			times.push(time);
		}

		return {
			times,
			average: times.reduce((a, b) => a + b, 0) / times.length,
			min: Math.min(...times),
			max: Math.max(...times)
		};
	}

	/**
	 * Monitor memory usage during theme operations
	 */
	async monitorMemoryUsage(): Promise<{
		initial: number;
		final: number;
		peak: number;
		increase: number;
	} | null> {
		return await this.page.evaluate(async () => {
			if (!('memory' in performance)) return null;

			const memory = (performance as any).memory;
			const initial = memory.usedJSHeapSize;
			let peak = initial;

			// Perform theme operations while monitoring memory
			const themeStore = (window as any).__themeStore;
			if (themeStore) {
				const themes = ['default', 'ocean', 'forest'];
				
				for (let i = 0; i < 50; i++) {
					const theme = themes[i % themes.length];
					themeStore.setPreset(theme);
					
					// Check memory every few operations
					if (i % 5 === 0) {
						const current = memory.usedJSHeapSize;
						if (current > peak) peak = current;
					}
					
					await new Promise(resolve => setTimeout(resolve, 10));
				}
			}

			// Force garbage collection if available
			if ((window as any).gc) {
				(window as any).gc();
			}

			const final = memory.usedJSHeapSize;

			return {
				initial,
				final,
				peak,
				increase: final - initial
			};
		});
	}

	/**
	 * Measure rendering performance
	 */
	async measureRenderingPerformance(): Promise<{
		firstPaint?: number;
		firstContentfulPaint?: number;
		layoutDuration: number;
		paintDuration: number;
	}> {
		return await this.page.evaluate(() => {
			const paintEntries = performance.getEntriesByType('paint');
			const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')?.startTime;
			const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime;

			// Measure layout and paint times
			let layoutDuration = 0;
			let paintDuration = 0;

			const measureEntries = performance.getEntriesByType('measure');
			measureEntries.forEach(entry => {
				if (entry.name.includes('layout')) {
					layoutDuration += entry.duration;
				} else if (entry.name.includes('paint')) {
					paintDuration += entry.duration;
				}
			});

			return {
				firstPaint,
				firstContentfulPaint,
				layoutDuration,
				paintDuration
			};
		});
	}

	/**
	 * Test performance under stress
	 */
	async stressTestPerformance(): Promise<{
		completed: boolean;
		errorRate: number;
		averageTime: number;
		memoryLeakDetected: boolean;
	}> {
		const results = await this.helpers.rapidThemeSwitching(['default', 'ocean', 'forest'], 100);
		const memoryInfo = await this.helpers.checkMemoryUsage();

		return {
			completed: results.errors === 0,
			errorRate: results.errors / 100,
			averageTime: results.averageTime,
			memoryLeakDetected: !!(memoryInfo && memoryInfo.percentIncrease > 15)
		};
	}
}

/**
 * Main page factory for creating page objects
 */
export class PageFactory {
	constructor(private page: Page) {}

	/**
	 * Create theme settings page object
	 */
	themeSettings(): ThemeSettingsPage {
		return new ThemeSettingsPage(this.page);
	}

	/**
	 * Create voice control page object
	 */
	voiceControl(): VoiceControlPage {
		return new VoiceControlPage(this.page);
	}

	/**
	 * Create theme preview page object
	 */
	themePreview(): ThemePreviewPage {
		return new ThemePreviewPage(this.page);
	}

	/**
	 * Create performance page object
	 */
	performance(): PerformancePage {
		return new PerformancePage(this.page);
	}
}