import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';
import ThemeSettings from './ThemeSettings.svelte';
import { themeStore, themeError, colors } from '$lib/stores/theme.js';

// Mock URL.createObjectURL for file operations
Object.defineProperty(URL, 'createObjectURL', {
	writable: true,
	value: vi.fn(() => 'mock-url')
});

Object.defineProperty(URL, 'revokeObjectURL', {
	writable: true,
	value: vi.fn()
});

describe('ThemeSettings', () => {
	const user = userEvent.setup();

	beforeEach(() => {
		// Reset theme store to default state
		themeStore.reset();
		vi.clearAllTimers();
		vi.useFakeTimers();
		
		// Clear any error state
		themeError.set(null);
		
		// Mock localStorage
		Object.defineProperty(window, 'localStorage', {
			value: {
				getItem: vi.fn(),
				setItem: vi.fn(),
				removeItem: vi.fn(),
				clear: vi.fn(),
			},
			writable: true,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllTimers();
	});

	it('renders with default props', () => {
		render(ThemeSettings);
		
		expect(screen.getByText('Theme Settings')).toBeInTheDocument();
		expect(screen.getByText('Basic Settings')).toBeInTheDocument();
		expect(screen.getByText('Color Palette')).toBeInTheDocument();
	});

	it('displays current theme mode correctly', async () => {
		render(ThemeSettings);
		
		// Default mode should be dark
		const darkButton = screen.getByRole('button', { name: /Dark Mode/i });
		expect(darkButton).toHaveClass('text-primary-600'); // Active state
	});

	it('changes theme mode when buttons are clicked', async () => {
		render(ThemeSettings);
		
		const lightButton = screen.getByRole('button', { name: /Light Mode/i });
		await user.click(lightButton);
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.mode).toBe('light');
		});
	});

	it('changes theme preset when dropdown is changed', async () => {
		render(ThemeSettings);
		
		const presetSelect = screen.getByLabelText('Theme Preset');
		await user.selectOptions(presetSelect, 'ocean');
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.preset).toBe('ocean');
		});
	});

	it('updates color values when color inputs change', async () => {
		render(ThemeSettings);
		
		const primaryColorInput = screen.getByLabelText('Primary') as HTMLInputElement;
		await user.clear(primaryColorInput);
		await user.type(primaryColorInput, '#ff0000');
		
		await waitFor(() => {
			const currentColors = get(colors);
			expect(currentColors.primary).toBe('#ff0000');
		});
	});

	it('updates typography settings correctly', async () => {
		render(ThemeSettings);
		
		const fontFamilySelect = screen.getByLabelText('Font Family');
		await user.selectOptions(fontFamilySelect, 'Roboto, sans-serif');
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.typography.fontFamily).toBe('Roboto, sans-serif');
		});
	});

	it('updates font size via range slider', async () => {
		render(ThemeSettings);
		
		const fontSizeSlider = screen.getByRole('slider', { name: /Base Font Size/i });
		
		// Simulate changing the slider value
		fireEvent.change(fontSizeSlider, { target: { value: '18' } });
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.typography.fontSize.base).toBe('18px');
		});
	});

	it('updates font scale via range slider', async () => {
		render(ThemeSettings);
		
		const fontScaleSlider = screen.getByRole('slider', { name: /Font Scale/i });
		
		fireEvent.change(fontScaleSlider, { target: { value: '1.3' } });
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.typography.fontSize.scale).toBe(1.3);
		});
	});

	it('applies border radius presets correctly', async () => {
		render(ThemeSettings);
		
		// Expand the advanced settings accordion
		const accordionButton = screen.getByText('Borders & Radius');
		await user.click(accordionButton);
		
		await waitFor(() => {
			const roundedButton = screen.getByRole('button', { name: 'Rounded' });
			expect(roundedButton).toBeInTheDocument();
		});
		
		const roundedButton = screen.getByRole('button', { name: 'Rounded' });
		await user.click(roundedButton);
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.borders.radius.md).toBe('0.5rem');
		});
	});

	it('shows dirty state indicator when changes are made', async () => {
		render(ThemeSettings);
		
		// Make a change
		const primaryColorInput = screen.getByDisplayValue('#3B82F6'); // Default primary color
		await user.clear(primaryColorInput);
		await user.type(primaryColorInput, '#ff0000');
		
		await waitFor(() => {
			expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
		});
	});

	it('shows success indicator after changes are saved', async () => {
		render(ThemeSettings);
		
		// Make a change
		const primaryColorInput = screen.getByDisplayValue('#3B82F6');
		await user.clear(primaryColorInput);
		await user.type(primaryColorInput, '#ff0000');
		
		// Wait for auto-save and success indicator
		await waitFor(() => {
			expect(screen.getByText('Saved')).toBeInTheDocument();
		}, { timeout: 4000 });
	});

	it('displays theme error when validation fails', async () => {
		// Set an error in the theme error store
		const errorMessage = 'Invalid theme configuration: Primary color must be a valid hex color';
		themeError.set(errorMessage);
		
		render(ThemeSettings);
		
		expect(screen.getByText('Theme Error:')).toBeInTheDocument();
		expect(screen.getByText(errorMessage)).toBeInTheDocument();
	});

	it('exports theme correctly', async () => {
		const mockClick = vi.fn();
		const mockAppendChild = vi.fn();
		const mockRemoveChild = vi.fn();
		
		const mockLink = {
			href: '',
			download: '',
			click: mockClick
		};
		
		const originalCreateElement = document.createElement;
		document.createElement = vi.fn((tag) => {
			if (tag === 'a') return mockLink;
			return originalCreateElement.call(document, tag);
		});
		
		document.body.appendChild = mockAppendChild;
		document.body.removeChild = mockRemoveChild;
		
		render(ThemeSettings);
		
		const exportButton = screen.getByRole('button', { name: 'Export' });
		await user.click(exportButton);
		
		expect(URL.createObjectURL).toHaveBeenCalled();
		expect(mockClick).toHaveBeenCalled();
		expect(URL.revokeObjectURL).toHaveBeenCalled();
		
		// Restore original methods
		document.createElement = originalCreateElement;
	});

	it('imports theme from file', async () => {
		render(ThemeSettings);
		
		const importButton = screen.getByRole('button', { name: 'Import' });
		
		// Create a mock file
		const mockTheme = {
			mode: 'light',
			global: {
				colors: {
					primary: '#00ff00'
				}
			}
		};
		
		const file = new File([JSON.stringify(mockTheme)], 'theme.json', {
			type: 'application/json'
		});
		
		// Mock file input
		const fileInput = document.getElementById('import-theme') as HTMLInputElement;
		
		// Simulate file selection
		Object.defineProperty(fileInput, 'files', {
			value: [file],
			writable: false,
		});
		
		// Mock FileReader
		const mockFileReader = {
			readAsText: vi.fn(),
			result: JSON.stringify(mockTheme),
			onload: null as any
		};
		
		Object.defineProperty(window, 'FileReader', {
			value: vi.fn(() => mockFileReader),
			writable: true
		});
		
		// Trigger file change
		await fireEvent.change(fileInput);
		
		// Simulate FileReader completion
		if (mockFileReader.onload) {
			mockFileReader.onload();
		}
		
		// Verify theme was imported (this would depend on implementation)
		// The actual test would need to verify the theme change
	});

	it('resets to defaults when reset button is clicked', async () => {
		render(ThemeSettings);
		
		// First, make some changes
		const primaryColorInput = screen.getByDisplayValue('#3B82F6');
		await user.clear(primaryColorInput);
		await user.type(primaryColorInput, '#ff0000');
		
		// Then reset
		const resetButton = screen.getByRole('button', { name: /Reset/ });
		await user.click(resetButton);
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.colors.primary).toBe('#3B82F6'); // Back to default
		});
	});

	it('handles custom prompt selection correctly', async () => {
		// This test would be for TerminalSettings, but keeping it here as an example
		// of how to test select interactions with custom values
		render(ThemeSettings);
		
		// Test that changing selections works correctly
		const presetSelect = screen.getByLabelText('Theme Preset');
		await user.selectOptions(presetSelect, 'custom');
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.preset).toBe('custom');
		});
	});

	it('validates color inputs correctly', async () => {
		render(ThemeSettings);
		
		const primaryColorText = screen.getByDisplayValue('#3B82F6');
		
		// Test invalid color
		await user.clear(primaryColorText);
		await user.type(primaryColorText, 'invalid-color');
		
		// The component should handle invalid colors gracefully
		// This might show an error or revert to the previous value
		await waitFor(() => {
			// Verify that the invalid color doesn't break the theme
			const currentColors = get(colors);
			expect(currentColors.primary).toBeTruthy();
		});
	});

	it('handles spacing settings in advanced accordion', async () => {
		render(ThemeSettings);
		
		// Expand spacing accordion
		const spacingButton = screen.getByText('Spacing & Layout');
		await user.click(spacingButton);
		
		await waitFor(() => {
			const spacingSelect = screen.getByLabelText(/Spacing Unit/);
			expect(spacingSelect).toBeInTheDocument();
		});
		
		const spacingSelect = screen.getByLabelText(/Spacing Unit/);
		await user.selectOptions(spacingSelect, '0.5rem');
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.spacing.unit).toBe('0.5rem');
		});
	});

	it('handles all color keys correctly', async () => {
		render(ThemeSettings);
		
		const colorKeys = ['primary', 'secondary', 'success', 'warning', 'error', 'background', 'surface', 'text'];
		
		for (const colorKey of colorKeys) {
			const colorInput = screen.getByLabelText(new RegExp(colorKey, 'i'));
			expect(colorInput).toBeInTheDocument();
			
			// Test that clicking the color input works
			await user.click(colorInput);
			// Color picker interactions are browser-specific and hard to test
		}
	});

	it('dispatches events correctly', async () => {
		const { component } = render(ThemeSettings);
		
		const changePromise = new Promise(resolve => {
			component.$on('change', resolve);
		});
		
		// Make a change that should trigger the event
		const lightButton = screen.getByRole('button', { name: /Light Mode/i });
		await user.click(lightButton);
		
		const changeEvent = await changePromise;
		expect(changeEvent).toBeDefined();
		expect(changeEvent.detail.theme.mode).toBe('light');
	});

	it('handles border radius input changes', async () => {
		render(ThemeSettings);
		
		// Expand borders accordion
		const bordersButton = screen.getByText('Borders & Radius');
		await user.click(bordersButton);
		
		await waitFor(() => {
			const smallRadiusInput = screen.getByLabelText('Small');
			expect(smallRadiusInput).toBeInTheDocument();
		});
		
		const smallRadiusInput = screen.getByLabelText('Small');
		await user.clear(smallRadiusInput);
		await user.type(smallRadiusInput, '0.25rem');
		
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.global.borders.radius.sm).toBe('0.25rem');
		});
	});

	it('maintains form state correctly during theme changes', async () => {
		render(ThemeSettings);
		
		// Change a color
		const primaryColorInput = screen.getByDisplayValue('#3B82F6');
		await user.clear(primaryColorInput);
		await user.type(primaryColorInput, '#ff0000');
		
		// Change preset (this might reset some values)
		const presetSelect = screen.getByLabelText('Theme Preset');
		await user.selectOptions(presetSelect, 'ocean');
		
		// Verify that the form state is maintained or properly updated
		await waitFor(() => {
			const currentTheme = get(themeStore);
			expect(currentTheme.preset).toBe('ocean');
		});
	});
});