import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ThemedTerminal from './ThemedTerminal.svelte';
import { themeStore, terminalTheme } from '$lib/stores/theme.js';

// Mock the voice recognition module
vi.mock('$lib/voiceRecognition.js', () => ({
	createVoiceRecognition: vi.fn(() => ({
		supported: true,
		listening: false,
		start: vi.fn(),
		stop: vi.fn()
	}))
}));

// Mock the mock commands module
vi.mock('$lib/mockCommands.js', () => ({
	processCommand: vi.fn((command: string) => {
		if (command === 'help') {
			return {
				output: ['Available commands:', '- help: Show this help', '- clear: Clear terminal'],
				type: 'info'
			};
		}
		if (command === 'clear') {
			return { output: 'CLEAR', type: 'info' };
		}
		return { output: `Command not found: ${command}`, type: 'error' };
	})
}));

describe('ThemedTerminal', () => {
	beforeEach(() => {
		// Reset theme store to default state
		themeStore.reset();
		
		// Clear any existing timers
		vi.clearAllTimers();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllTimers();
	});

	it('renders with default props', () => {
		const { container } = render(ThemedTerminal);
		
		expect(container.querySelector('.terminal-card')).toBeInTheDocument();
		expect(screen.getByText('Voice Terminal Hybrid')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Enter command or use voice input...')).toBeInTheDocument();
	});

	it('applies theme styles correctly', async () => {
		// Set a custom theme
		const customTheme = {
			components: {
				terminal: {
					inherit: false,
					background: '#1a1a1a',
					color: '#ffffff',
					fontFamily: 'Monaco, monospace',
					fontSize: '16px'
				}
			}
		};
		
		themeStore.setComponentTheme('terminal', customTheme.components.terminal);
		
		const { container } = render(ThemedTerminal);
		const terminalCard = container.querySelector('.terminal-card');
		
		// Check if custom styles are applied via CSS custom properties
		expect(terminalCard).toHaveStyle('--terminal-bg: #1a1a1a');
	});

	it('handles different size variants', () => {
		const { rerender } = render(ThemedTerminal, { variant: 'compact' });
		let container = document.querySelector('.terminal-content');
		expect(container).toHaveClass('h-48');

		rerender({ variant: 'fullscreen' });
		container = document.querySelector('.terminal-content');
		expect(container).toHaveClass('h-screen');

		rerender({ variant: 'standard' });
		container = document.querySelector('.terminal-content');
		expect(container).toHaveClass('h-96');
	});

	it('executes commands and displays output', async () => {
		const { container } = render(ThemedTerminal);
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		
		// Type and execute help command
		await fireEvent.input(input, { target: { value: 'help' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		await waitFor(() => {
			expect(screen.getByText('$ help')).toBeInTheDocument();
			expect(screen.getByText('Available commands:')).toBeInTheDocument();
		});
	});

	it('clears terminal when clear command is executed', async () => {
		const { container } = render(ThemedTerminal);
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		
		// First add some content
		await fireEvent.input(input, { target: { value: 'help' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		await waitFor(() => {
			expect(screen.getByText('$ help')).toBeInTheDocument();
		});
		
		// Clear terminal
		await fireEvent.input(input, { target: { value: 'clear' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		await waitFor(() => {
			expect(screen.queryByText('$ help')).not.toBeInTheDocument();
		});
	});

	it('handles command history navigation', async () => {
		const { container } = render(ThemedTerminal);
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		
		// Execute a few commands
		await fireEvent.input(input, { target: { value: 'help' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		await fireEvent.input(input, { target: { value: 'test' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		// Navigate history with arrow up
		await fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp' });
		expect(input).toHaveValue('test');
		
		await fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp' });
		expect(input).toHaveValue('help');
		
		// Navigate down
		await fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
		expect(input).toHaveValue('test');
	});

	it('limits output lines according to maxLines prop', async () => {
		const maxLines = 5;
		const { container } = render(ThemedTerminal, { maxLines });
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		
		// Add more lines than the limit
		for (let i = 0; i < maxLines + 3; i++) {
			await fireEvent.input(input, { target: { value: `command${i}` } });
			await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		}
		
		await waitFor(() => {
			const outputLines = container.querySelectorAll('.output-line');
			expect(outputLines.length).toBeLessThanOrEqual(maxLines);
		});
	});

	it('shows voice indicator when voice is enabled', () => {
		render(ThemedTerminal, { enableVoice: true });
		expect(document.querySelector('.voice-indicator')).toBeInTheDocument();
	});

	it('hides voice indicator when voice is disabled', () => {
		render(ThemedTerminal, { enableVoice: false });
		expect(document.querySelector('.voice-indicator')).not.toBeInTheDocument();
	});

	it('handles voice input correctly', async () => {
		const { component } = render(ThemedTerminal, { enableVoice: true });
		const voiceButton = document.querySelector('.voice-indicator button');
		
		expect(voiceButton).toBeInTheDocument();
		
		// Mock voice recognition start
		const mockVoiceRecognition = {
			supported: true,
			listening: false,
			start: vi.fn((onResult, onError, onEnd) => {
				// Simulate successful voice recognition
				setTimeout(() => {
					onResult({ transcript: 'help', confidence: 0.9, isFinal: true });
				}, 100);
			}),
			stop: vi.fn()
		};
		
		// Replace the voice recognition instance
		component.$set({ voiceRecognition: mockVoiceRecognition });
		
		await fireEvent.click(voiceButton);
		
		// Advance timers to trigger voice result
		vi.advanceTimersByTime(150);
		
		await waitFor(() => {
			expect(screen.getByText('$ help')).toBeInTheDocument();
		});
	});

	it('shows error for unsupported voice recognition', async () => {
		const { component } = render(ThemedTerminal, { enableVoice: true });
		
		// Mock unsupported voice recognition
		const mockVoiceRecognition = {
			supported: false,
			listening: false,
			start: vi.fn(),
			stop: vi.fn()
		};
		
		component.$set({ voiceRecognition: mockVoiceRecognition });
		
		const voiceButton = document.querySelector('.voice-indicator button');
		await fireEvent.click(voiceButton);
		
		await waitFor(() => {
			expect(screen.getByText(/Voice recognition is not supported/)).toBeInTheDocument();
		});
	});

	it('handles export functionality', async () => {
		// Mock URL.createObjectURL and document.createElement
		const mockCreateObjectURL = vi.fn(() => 'mock-url');
		const mockRevokeObjectURL = vi.fn();
		const mockClick = vi.fn();
		const mockAppendChild = vi.fn();
		const mockRemoveChild = vi.fn();
		
		Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL });
		Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL });
		
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
		
		const { container } = render(ThemedTerminal);
		
		// Add some content first
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		await fireEvent.input(input, { target: { value: 'help' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		// Find and click export button
		const exportButton = screen.getByText('Export');
		await fireEvent.click(exportButton);
		
		expect(mockCreateObjectURL).toHaveBeenCalled();
		expect(mockClick).toHaveBeenCalled();
		expect(mockRevokeObjectURL).toHaveBeenCalled();
		
		// Restore original methods
		document.createElement = originalCreateElement;
	});

	it('applies custom classes correctly', () => {
		const customClass = 'my-custom-terminal';
		const { container } = render(ThemedTerminal, { customClass });
		
		expect(container.querySelector('.terminal-card')).toHaveClass(customClass);
	});

	it('handles header visibility', () => {
		const { rerender } = render(ThemedTerminal, { showHeader: true });
		expect(screen.getByText('Voice Terminal Hybrid')).toBeInTheDocument();
		
		rerender({ showHeader: false });
		expect(screen.queryByText('Voice Terminal Hybrid')).not.toBeInTheDocument();
	});

	it('uses custom header title', () => {
		const customTitle = 'My Custom Terminal';
		render(ThemedTerminal, { headerTitle: customTitle });
		
		expect(screen.getByText(customTitle)).toBeInTheDocument();
	});

	it('handles custom placeholder text', () => {
		const customPlaceholder = 'Type your command here...';
		render(ThemedTerminal, { placeholder: customPlaceholder });
		
		expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
	});

	it('respects autoFocus prop', () => {
		const { rerender } = render(ThemedTerminal, { autoFocus: true });
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		expect(input).toHaveFocus();
		
		// Note: Testing autoFocus: false is complex in jsdom as focus behavior differs from real browsers
	});

	it('handles theme inheritance correctly', async () => {
		// Test with inherit: true
		themeStore.setComponentTheme('terminal', {
			inherit: true,
			overrides: {
				fontSize: '18px'
			}
		});
		
		const { container } = render(ThemedTerminal);
		const terminalOutput = container.querySelector('.terminal-output');
		
		await waitFor(() => {
			// Should apply global theme colors with overrides
			expect(terminalOutput).toHaveStyle('font-size: 18px');
		});
	});

	it('validates theme prop changes', async () => {
		const { component } = render(ThemedTerminal);
		
		// Change theme and verify it's applied
		const newTheme = {
			background: '#ff0000',
			color: '#00ff00',
			fontFamily: 'Arial, sans-serif'
		};
		
		themeStore.setComponentTheme('terminal', newTheme);
		
		await waitFor(() => {
			const terminalCard = document.querySelector('.terminal-card');
			expect(terminalCard).toHaveStyle('--terminal-bg: #ff0000');
		});
	});

	it('handles accessibility attributes correctly', () => {
		render(ThemedTerminal);
		
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		expect(input).toHaveAttribute('autocomplete', 'off');
		expect(input).toHaveAttribute('spellcheck', 'false');
		
		if (document.querySelector('.voice-indicator')) {
			const voiceButton = document.querySelector('.voice-indicator button');
			expect(voiceButton).toHaveAttribute('aria-label');
		}
	});

	it('handles error states properly', async () => {
		const { container } = render(ThemedTerminal);
		const input = screen.getByPlaceholderText('Enter command or use voice input...');
		
		// Execute a command that returns an error
		await fireEvent.input(input, { target: { value: 'invalid-command' } });
		await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
		
		await waitFor(() => {
			const errorOutput = container.querySelector('.text-red-400');
			expect(errorOutput).toBeInTheDocument();
		});
	});
});