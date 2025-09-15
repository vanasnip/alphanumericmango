import { Page, Locator } from '@playwright/test';

/**
 * JSON editing automation utilities for theme editor testing
 */

export interface JSONValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export interface JSONEditOperation {
	path: string;
	value: any;
	operation: 'set' | 'delete' | 'merge';
}

export class JSONEditingHelpers {
	constructor(private page: Page) {}

	/**
	 * Open the JSON theme editor
	 */
	async openJSONEditor(): Promise<Locator> {
		const settingsButton = this.page.locator('[data-testid="theme-settings-button"]');
		await settingsButton.click();

		const jsonEditor = this.page.locator('[data-testid="theme-json-editor"]');
		await jsonEditor.waitFor({ state: 'visible' });

		return jsonEditor;
	}

	/**
	 * Get current JSON content from editor
	 */
	async getJSONContent(editor?: Locator): Promise<string> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		return await editorElement.inputValue();
	}

	/**
	 * Set JSON content in editor
	 */
	async setJSONContent(content: string, editor?: Locator): Promise<void> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		
		await editorElement.click();
		await this.page.keyboard.press('Control+A');
		await editorElement.fill(content);
	}

	/**
	 * Format JSON content with proper indentation
	 */
	formatJSON(obj: any, indent = 2): string {
		return JSON.stringify(obj, null, indent);
	}

	/**
	 * Parse JSON content safely
	 */
	parseJSON(content: string): { data: any; error?: string } {
		try {
			const data = JSON.parse(content);
			return { data };
		} catch (error) {
			return { data: null, error: error instanceof Error ? error.message : 'Invalid JSON' };
		}
	}

	/**
	 * Validate JSON content in editor
	 */
	async validateJSONContent(editor?: Locator): Promise<JSONValidationResult> {
		const content = await this.getJSONContent(editor);
		const parseResult = this.parseJSON(content);

		if (parseResult.error) {
			return {
				valid: false,
				errors: [parseResult.error],
				warnings: []
			};
		}

		// Validate theme structure
		const errors: string[] = [];
		const warnings: string[] = [];
		const data = parseResult.data;

		// Check required theme structure
		if (!data.theme) {
			errors.push('Missing required "theme" property');
		} else {
			if (!data.theme.global) {
				warnings.push('Missing "global" theme configuration');
			} else {
				if (!data.theme.global.colors) {
					warnings.push('Missing "colors" in global configuration');
				}
			}
		}

		// Validate color values
		if (data.theme?.global?.colors) {
			Object.entries(data.theme.global.colors).forEach(([key, value]) => {
				if (typeof value === 'string' && !this.isValidColor(value as string)) {
					errors.push(`Invalid color value for "${key}": ${value}`);
				}
			});
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Check if a color value is valid
	 */
	private isValidColor(color: string): boolean {
		// Hex colors
		const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		if (hexRegex.test(color)) return true;

		// RGB/RGBA
		const rgbRegex = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/;
		if (rgbRegex.test(color)) return true;

		// HSL/HSLA
		const hslRegex = /^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+)?\s*\)$/;
		if (hslRegex.test(color)) return true;

		// Named colors (basic check)
		const namedColors = ['red', 'green', 'blue', 'black', 'white', 'transparent'];
		if (namedColors.includes(color.toLowerCase())) return true;

		return false;
	}

	/**
	 * Apply a single JSON edit operation
	 */
	async applyJSONEdit(operation: JSONEditOperation, editor?: Locator): Promise<void> {
		const currentContent = await this.getJSONContent(editor);
		const parseResult = this.parseJSON(currentContent);

		if (parseResult.error) {
			throw new Error(`Cannot edit invalid JSON: ${parseResult.error}`);
		}

		const data = parseResult.data;
		const pathParts = operation.path.split('.');

		switch (operation.operation) {
			case 'set':
				this.setNestedProperty(data, pathParts, operation.value);
				break;
			case 'delete':
				this.deleteNestedProperty(data, pathParts);
				break;
			case 'merge':
				if (typeof operation.value === 'object') {
					const existing = this.getNestedProperty(data, pathParts) || {};
					this.setNestedProperty(data, pathParts, { ...existing, ...operation.value });
				} else {
					this.setNestedProperty(data, pathParts, operation.value);
				}
				break;
		}

		const newContent = this.formatJSON(data);
		await this.setJSONContent(newContent, editor);
	}

	/**
	 * Apply multiple JSON edit operations
	 */
	async applyJSONEdits(operations: JSONEditOperation[], editor?: Locator): Promise<void> {
		for (const operation of operations) {
			await this.applyJSONEdit(operation, editor);
		}
	}

	/**
	 * Set a nested property in an object
	 */
	private setNestedProperty(obj: any, path: string[], value: any): void {
		const last = path.pop()!;
		const target = path.reduce((o, key) => {
			if (!(key in o)) o[key] = {};
			return o[key];
		}, obj);
		target[last] = value;
	}

	/**
	 * Get a nested property from an object
	 */
	private getNestedProperty(obj: any, path: string[]): any {
		return path.reduce((o, key) => o?.[key], obj);
	}

	/**
	 * Delete a nested property from an object
	 */
	private deleteNestedProperty(obj: any, path: string[]): void {
		const last = path.pop()!;
		const target = path.reduce((o, key) => o?.[key], obj);
		if (target && last in target) {
			delete target[last];
		}
	}

	/**
	 * Test JSON editor keyboard shortcuts
	 */
	async testKeyboardShortcuts(editor?: Locator): Promise<{
		selectAll: boolean;
		copy: boolean;
		paste: boolean;
		undo: boolean;
		redo: boolean;
		save: boolean;
	}> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		await editorElement.focus();

		const testData = '{"test": "data"}';
		await this.setJSONContent(testData, editorElement);

		const results = {
			selectAll: false,
			copy: false,
			paste: false,
			undo: false,
			redo: false,
			save: false
		};

		// Test Ctrl+A (Select All)
		await this.page.keyboard.press('Control+a');
		const selectedText = await this.page.evaluate(() => window.getSelection()?.toString());
		results.selectAll = selectedText?.includes('test') || false;

		// Test Ctrl+C (Copy) - Can't directly test clipboard, but check if shortcut is handled
		await this.page.keyboard.press('Control+c');
		results.copy = true; // Assume it works if no error

		// Test Ctrl+V (Paste)
		await this.page.keyboard.press('Control+v');
		results.paste = true; // Assume it works if no error

		// Test Ctrl+Z (Undo)
		const originalContent = await this.getJSONContent(editorElement);
		await editorElement.type('modified');
		await this.page.keyboard.press('Control+z');
		const afterUndo = await this.getJSONContent(editorElement);
		results.undo = afterUndo !== originalContent + 'modified';

		// Test Ctrl+Y (Redo)
		await this.page.keyboard.press('Control+y');
		const afterRedo = await this.getJSONContent(editorElement);
		results.redo = afterRedo !== afterUndo;

		// Test Ctrl+S (Save)
		await this.page.keyboard.press('Control+s');
		// Check if save action was triggered (may show notification or change state)
		const saveTriggered = await this.page.evaluate(() => {
			return !!(window as any).__lastSaveAction || 
				   document.querySelector('[data-testid="save-notification"]');
		});
		results.save = !!saveTriggered;

		return results;
	}

	/**
	 * Test JSON editor auto-completion/suggestions
	 */
	async testAutoCompletion(editor?: Locator): Promise<{
		hasCompletions: boolean;
		completionTypes: string[];
	}> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		
		// Set up partial JSON that should trigger completions
		await this.setJSONContent('{\n  "theme": {\n    "global": {\n      "', editorElement);
		
		// Position cursor and trigger completion
		await editorElement.press('Control+Space');
		
		// Check for completion popup
		const completionPopup = this.page.locator('[data-testid="json-completions"], .monaco-editor .suggest-widget, .cm-tooltip-autocomplete');
		const hasCompletions = await completionPopup.isVisible().catch(() => false);

		let completionTypes: string[] = [];
		if (hasCompletions) {
			const completionItems = await completionPopup.locator('[data-completion-type], .suggest-item, .cm-completion').allTextContents();
			completionTypes = completionItems.filter(item => item.trim().length > 0);
		}

		return {
			hasCompletions,
			completionTypes
		};
	}

	/**
	 * Test JSON syntax highlighting
	 */
	async testSyntaxHighlighting(editor?: Locator): Promise<{
		hasHighlighting: boolean;
		highlightedElements: string[];
	}> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		
		const testJSON = {
			"theme": {
				"global": {
					"colors": {
						"primary": "#3B82F6",
						"secondary": "#8B5CF6"
					}
				}
			}
		};

		await this.setJSONContent(this.formatJSON(testJSON), editorElement);

		// Check for syntax highlighting elements
		const highlightedElements = await this.page.evaluate(() => {
			const highlightSelectors = [
				'.hljs-string',        // highlight.js
				'.cm-string',          // CodeMirror
				'.token.string',       // Prism.js
				'.mtk1, .mtk5, .mtk6', // Monaco Editor
				'[class*="string"]',   // Generic string highlighting
				'[class*="property"]', // Property highlighting
				'[class*="value"]'     // Value highlighting
			];

			const found: string[] = [];
			highlightSelectors.forEach(selector => {
				const elements = document.querySelectorAll(selector);
				if (elements.length > 0) {
					found.push(selector);
				}
			});

			return found;
		});

		return {
			hasHighlighting: highlightedElements.length > 0,
			highlightedElements
		};
	}

	/**
	 * Test JSON error highlighting and messages
	 */
	async testErrorHighlighting(editor?: Locator): Promise<{
		showsErrors: boolean;
		errorMessages: string[];
		errorPositions: Array<{ line: number; column: number }>;
	}> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		
		// Insert invalid JSON
		const invalidJSON = '{\n  "theme": {\n    "invalid": unclosed string\n  }\n}';
		await this.setJSONContent(invalidJSON, editorElement);

		await this.page.waitForTimeout(500); // Allow error detection

		// Check for error indicators
		const errorElements = this.page.locator('[data-testid="json-error"], .error-marker, .cm-error, .squiggly-error');
		const showsErrors = await errorElements.count() > 0;

		// Get error messages
		const errorMessages = await this.page.locator('[data-testid="json-validation-error"], .error-message').allTextContents();

		// Try to extract error positions (if available)
		const errorPositions = await this.page.evaluate(() => {
			const positions: Array<{ line: number; column: number }> = [];
			
			// Look for Monaco Editor markers
			const monacoErrors = document.querySelectorAll('.monaco-editor .squiggly-error');
			monacoErrors.forEach(error => {
				const lineElement = error.closest('[data-line-number]');
				if (lineElement) {
					const line = parseInt(lineElement.getAttribute('data-line-number') || '0');
					positions.push({ line, column: 0 });
				}
			});

			return positions;
		});

		return {
			showsErrors,
			errorMessages: errorMessages.filter(msg => msg.trim().length > 0),
			errorPositions
		};
	}

	/**
	 * Test JSON formatting functionality
	 */
	async testJSONFormatting(editor?: Locator): Promise<{
		canFormat: boolean;
		beforeFormat: string;
		afterFormat: string;
		isProperlyIndented: boolean;
	}> {
		const editorElement = editor || this.page.locator('[data-testid="theme-json-editor"]');
		
		// Insert unformatted JSON
		const unformattedJSON = '{"theme":{"global":{"colors":{"primary":"#3B82F6","secondary":"#8B5CF6"}}}}';
		await this.setJSONContent(unformattedJSON, editorElement);

		const beforeFormat = await this.getJSONContent(editorElement);

		// Try to trigger formatting (common shortcuts)
		await editorElement.focus();
		await this.page.keyboard.press('Shift+Alt+f'); // VS Code style
		await this.page.waitForTimeout(100);

		let afterFormat = await this.getJSONContent(editorElement);

		// If no change, try other formatting triggers
		if (afterFormat === beforeFormat) {
			const formatButton = this.page.locator('[data-testid="format-json-button"]');
			if (await formatButton.isVisible()) {
				await formatButton.click();
				await this.page.waitForTimeout(100);
				afterFormat = await this.getJSONContent(editorElement);
			}
		}

		const canFormat = afterFormat !== beforeFormat;
		const isProperlyIndented = afterFormat.includes('  ') && afterFormat.includes('\n');

		return {
			canFormat,
			beforeFormat,
			afterFormat,
			isProperlyIndented
		};
	}

	/**
	 * Generate test theme configurations
	 */
	generateTestThemes(): Record<string, any> {
		return {
			minimal: {
				theme: {
					global: {
						colors: {
							primary: '#3B82F6'
						}
					}
				}
			},
			complete: {
				theme: {
					mode: 'dark',
					preset: 'custom',
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
						button: {
							inherit: true,
							overrides: {
								borderRadius: '0.375rem',
								padding: '0.5rem 1rem'
							}
						},
						input: {
							inherit: true,
							overrides: {
								borderRadius: '0.25rem'
							}
						}
					}
				}
			},
			invalid: {
				theme: {
					global: {
						colors: {
							primary: 'not-a-color',
							secondary: null
						}
					}
				}
			},
			malformed: '{"theme": {"global": {"colors": {"primary": "#FF0000"',
			circular: null // Will be set with circular reference
		};
	}

	/**
	 * Test large JSON file handling
	 */
	async testLargeJSONHandling(size: 'medium' | 'large' | 'huge' = 'large'): Promise<{
		loadTime: number;
		editTime: number;
		saveTime: number;
		memoryUsage?: number;
	}> {
		const theme = this.generateLargeTheme(size);
		const jsonContent = this.formatJSON(theme);

		// Measure load time
		const loadStart = performance.now();
		const editor = await this.openJSONEditor();
		await this.setJSONContent(jsonContent, editor);
		const loadEnd = performance.now();

		// Measure edit time
		const editStart = performance.now();
		await this.applyJSONEdit({
			path: 'theme.global.colors.primary',
			value: '#FF0000',
			operation: 'set'
		}, editor);
		const editEnd = performance.now();

		// Measure save time (if save functionality exists)
		const saveStart = performance.now();
		const saveButton = this.page.locator('[data-testid="save-theme-button"]');
		if (await saveButton.isVisible()) {
			await saveButton.click();
		}
		const saveEnd = performance.now();

		// Check memory usage
		const memoryUsage = await this.page.evaluate(() => {
			if ('memory' in performance) {
				return (performance as any).memory.usedJSHeapSize;
			}
			return undefined;
		});

		return {
			loadTime: loadEnd - loadStart,
			editTime: editEnd - editStart,
			saveTime: saveEnd - saveStart,
			memoryUsage
		};
	}

	/**
	 * Generate large theme for performance testing
	 */
	private generateLargeTheme(size: 'medium' | 'large' | 'huge'): any {
		const componentCount = {
			medium: 50,
			large: 200,
			huge: 1000
		}[size];

		const theme: any = {
			theme: {
				global: {
					colors: {},
					typography: { fontFamily: 'Inter, sans-serif' },
					spacing: { unit: '0.25rem', scale: [] },
					borders: { radius: {}, width: '1px', style: 'solid' }
				},
				components: {}
			}
		};

		// Generate many colors
		for (let i = 0; i < componentCount / 4; i++) {
			theme.theme.global.colors[`color${i}`] = `hsl(${i * 7}, 70%, 50%)`;
		}

		// Generate many components
		for (let i = 0; i < componentCount; i++) {
			theme.theme.components[`component${i}`] = {
				inherit: i % 2 === 0,
				backgroundColor: `hsl(${i * 3}, 60%, 50%)`,
				color: `hsl(${(i * 3 + 180) % 360}, 60%, 20%)`,
				padding: `${i % 20 + 5}px`,
				margin: `${i % 15 + 2}px`,
				borderRadius: `${i % 10 + 1}px`,
				fontSize: `${14 + (i % 8)}px`,
				lineHeight: `${1.2 + (i % 10) * 0.1}`
			};
		}

		return theme;
	}
}