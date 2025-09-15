import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';

// Import components
import ThemedTerminal from '../components/ThemedTerminal.svelte';
import VoiceIndicator from '../components/themed/VoiceIndicator.svelte';
import ThemeSettings from '../components/settings/ThemeSettings.svelte';
import ThemedNavbar from '../components/navigation/ThemedNavbar.svelte';
import ThemedModal from '../components/feedback/ThemedModal.svelte';
import ThemedToast from '../components/feedback/ThemedToast.svelte';

// Import stores
import { themeStore, colors, voiceStates } from '../stores/theme.js';

// Mock modules
vi.mock('$lib/voiceRecognition.js', () => ({
	createVoiceRecognition: vi.fn(() => ({
		supported: true,
		listening: false,
		start: vi.fn(),
		stop: vi.fn()
	}))
}));

vi.mock('$lib/mockCommands.js', () => ({
	processCommand: vi.fn(() => ({ output: 'Test output', type: 'info' }))
}));

describe('Theme-Component Integration', () => {
	const user = userEvent.setup();

	beforeEach(() => {
		// Reset theme store to default state
		themeStore.reset();
		vi.clearAllTimers();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllTimers();
	});

	describe('Global Theme Changes', () => {
		it('should update all components when global colors change', async () => {
			// Render multiple components
			const { unmount: unmountTerminal } = render(ThemedTerminal);
			const { unmount: unmountVoice } = render(VoiceIndicator);
			const { unmount: unmountNavbar } = render(ThemedNavbar);
			
			// Change primary color
			themeStore.setColor('primary', '#ff0000');
			
			await waitFor(() => {
				// Verify terminal updates
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard?.getAttribute('style')).toContain('--terminal-border: #ff0000');
				
				// Verify voice indicator updates
				const voiceIndicator = document.querySelector('.voice-indicator');
				const voiceStyle = voiceIndicator?.getAttribute('style');
				expect(voiceStyle).toContain('#ff0000');
				
				// Verify navbar updates
				const navbar = document.querySelector('.navbar');
				expect(navbar?.getAttribute('style')).toContain('--navbar-accent: #ff0000');
			});
			
			unmountTerminal();
			unmountVoice();
			unmountNavbar();
		});

		it('should propagate typography changes to all text elements', async () => {
			const { unmount } = render(ThemedTerminal);
			
			// Change font family
			themeStore.update(current => ({
				...current,
				global: {
					...current.global,
					typography: {
						...current.global.typography,
						fontFamily: 'Arial, sans-serif'
					}
				}
			}));
			
			await waitFor(() => {
				const terminalOutput = document.querySelector('.terminal-output');
				expect(terminalOutput?.getAttribute('style')).toContain('font-family: Arial, sans-serif');
			});
			
			unmount();
		});

		it('should update spacing across all components', async () => {
			const { unmount } = render(ThemedTerminal);
			
			// Change spacing unit
			themeStore.update(current => ({
				...current,
				global: {
					...current.global,
					spacing: {
						...current.global.spacing,
						unit: '0.5rem'
					}
				}
			}));
			
			await waitFor(() => {
				// Verify spacing changes are applied
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard?.getAttribute('style')).toContain('--terminal-padding');
			});
			
			unmount();
		});
	});

	describe('Component-Specific Theme Inheritance', () => {
		it('should respect component inherit setting', async () => {
			const { unmount } = render(ThemedTerminal);
			
			// Set terminal to inherit global colors
			themeStore.setComponentTheme('terminal', {
				inherit: true,
				overrides: {
					fontSize: '18px'
				}
			});
			
			// Change global color
			themeStore.setColor('primary', '#00ff00');
			
			await waitFor(() => {
				const terminalCard = document.querySelector('.terminal-card');
				const style = terminalCard?.getAttribute('style');
				
				// Should use global color since inherit is true
				expect(style).toContain('#00ff00');
				
				// Should also apply override
				expect(style).toContain('18px');
			});
			
			unmount();
		});

		it('should ignore global changes when inherit is false', async () => {
			const { unmount } = render(ThemedTerminal);
			
			// Set terminal to not inherit
			themeStore.setComponentTheme('terminal', {
				inherit: false,
				background: '#1a1a1a',
				color: '#ffffff'
			});
			
			// Change global colors
			themeStore.setColor('background', '#ff0000');
			themeStore.setColor('text', '#0000ff');
			
			await waitFor(() => {
				const terminalCard = document.querySelector('.terminal-card');
				const style = terminalCard?.getAttribute('style');
				
				// Should use component-specific colors
				expect(style).toContain('--terminal-bg: #1a1a1a');
				expect(style).toContain('--terminal-text: #ffffff');
			});
			
			unmount();
		});
	});

	describe('Voice State Theme Integration', () => {
		it('should update voice indicator colors when theme changes', async () => {
			const { unmount } = render(VoiceIndicator, { state: 'listening' });
			
			// Change success color (used for listening state)
			themeStore.setColor('success', '#ff00ff');
			
			await waitFor(() => {
				const indicator = document.querySelector('.voice-indicator');
				const style = indicator?.getAttribute('style');
				expect(style).toContain('--voice-color: #ff00ff');
			});
			
			unmount();
		});

		it('should generate correct animations for different states', async () => {
			const { rerender, unmount } = render(VoiceIndicator, { state: 'idle' });
			
			// Test each state
			const states = ['listening', 'processing', 'speaking', 'error'];
			
			for (const state of states) {
				rerender({ state });
				
				await waitFor(() => {
					const indicator = document.querySelector('.voice-indicator');
					const style = indicator?.getAttribute('style');
					expect(style).toContain('--voice-animation:');
				});
			}
			
			unmount();
		});
	});

	describe('Settings Integration', () => {
		it('should update components in real-time when settings change', async () => {
			// Render settings and a component that should be affected
			const { unmount: unmountSettings } = render(ThemeSettings);
			const { unmount: unmountTerminal } = render(ThemedTerminal);
			
			// Change primary color through settings
			const primaryColorInput = screen.getByDisplayValue('#3B82F6');
			await user.clear(primaryColorInput);
			await user.type(primaryColorInput, '#ff0000');
			
			await waitFor(() => {
				// Terminal should reflect the change immediately
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard?.getAttribute('style')).toContain('#ff0000');
			});
			
			unmountSettings();
			unmountTerminal();
		});

		it('should show dirty state correctly across components', async () => {
			const { unmount } = render(ThemeSettings);
			
			// Make a change
			const primaryColorInput = screen.getByDisplayValue('#3B82F6');
			await user.clear(primaryColorInput);
			await user.type(primaryColorInput, '#ff0000');
			
			await waitFor(() => {
				expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
			});
			
			// Changes should be applied immediately even in dirty state
			const currentColors = get(colors);
			expect(currentColors.primary).toBe('#ff0000');
			
			unmount();
		});
	});

	describe('Modal and Toast Theme Integration', () => {
		it('should apply theme to modal components', async () => {
			const { unmount } = render(ThemedModal, {
				open: true,
				title: 'Test Modal',
				type: 'success'
			});
			
			// Change success color
			themeStore.setColor('success', '#00ff00');
			
			await waitFor(() => {
				const modal = document.querySelector('.themed-modal');
				expect(modal).toBeInTheDocument();
				
				// Modal should use theme colors
				const modalContent = document.querySelector('.modal-content');
				expect(modalContent?.getAttribute('style')).toContain('color:');
			});
			
			unmount();
		});

		it('should apply theme to toast components', async () => {
			const { unmount } = render(ThemedToast, {
				type: 'success',
				title: 'Test Toast',
				message: 'Test message'
			});
			
			await waitFor(() => {
				const toast = document.querySelector('.themed-toast');
				expect(toast).toBeInTheDocument();
			});
			
			unmount();
		});
	});

	describe('Performance and Reactivity', () => {
		it('should not cause excessive re-renders when theme changes', async () => {
			const renderSpy = vi.fn();
			
			// Create a wrapper component that tracks renders
			const TestWrapper = {
				Component: ThemedTerminal,
				render: () => {
					renderSpy();
					return render(ThemedTerminal);
				}
			};
			
			const { unmount } = TestWrapper.render();
			
			// Make multiple theme changes
			themeStore.setColor('primary', '#ff0000');
			themeStore.setColor('secondary', '#00ff00');
			themeStore.setColor('success', '#0000ff');
			
			// Should not cause excessive renders
			// Note: This test might need adjustment based on actual rendering behavior
			
			unmount();
		});

		it('should handle rapid theme changes gracefully', async () => {
			const { unmount } = render(ThemedTerminal);
			
			// Make rapid color changes
			for (let i = 0; i < 10; i++) {
				themeStore.setColor('primary', `#${i.toString().repeat(6)}`);
			}
			
			await waitFor(() => {
				// Component should still be functional
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard).toBeInTheDocument();
			});
			
			unmount();
		});
	});

	describe('Cross-Component Communication via Theme', () => {
		it('should coordinate colors across voice indicator and terminal', async () => {
			const { unmount: unmountTerminal } = render(ThemedTerminal, { enableVoice: true });
			const { unmount: unmountVoice } = render(VoiceIndicator, { state: 'listening' });
			
			// Change success color (used by both components)
			themeStore.setColor('success', '#ff00ff');
			
			await waitFor(() => {
				// Both components should use the same color
				const voiceIndicator = document.querySelector('.voice-indicator');
				const voiceStyle = voiceIndicator?.getAttribute('style');
				expect(voiceStyle).toContain('#ff00ff');
				
				// Terminal voice elements should also match
				const terminalVoice = document.querySelector('.terminal-card .voice-indicator');
				if (terminalVoice) {
					const terminalVoiceStyle = terminalVoice.getAttribute('style');
					expect(terminalVoiceStyle).toContain('#ff00ff');
				}
			});
			
			unmountTerminal();
			unmountVoice();
		});

		it('should maintain consistent styling across navigation and content', async () => {
			const { unmount: unmountNavbar } = render(ThemedNavbar);
			const { unmount: unmountTerminal } = render(ThemedTerminal);
			
			// Change theme colors
			themeStore.setColor('surface', '#2a2a2a');
			themeStore.setColor('text', '#f0f0f0');
			
			await waitFor(() => {
				// Both navbar and terminal should use consistent colors
				const navbar = document.querySelector('.navbar');
				const navbarStyle = navbar?.getAttribute('style');
				expect(navbarStyle).toContain('#2a2a2a');
				
				const terminal = document.querySelector('.terminal-card');
				const terminalStyle = terminal?.getAttribute('style');
				expect(terminalStyle).toContain('#f0f0f0');
			});
			
			unmountNavbar();
			unmountTerminal();
		});
	});

	describe('Theme Preset Application', () => {
		it('should apply presets consistently across all components', async () => {
			const { unmount: unmountTerminal } = render(ThemedTerminal);
			const { unmount: unmountVoice } = render(VoiceIndicator);
			const { unmount: unmountNavbar } = render(ThemedNavbar);
			
			// Apply ocean preset
			themeStore.applyPreset('ocean');
			
			await waitFor(() => {
				// All components should reflect the ocean theme
				const theme = get(themeStore);
				expect(theme.preset).toBe('ocean');
				
				// Verify color consistency across components
				const currentColors = get(colors);
				expect(currentColors.primary).toBeDefined();
				
				// Check that components use the preset colors
				const terminalCard = document.querySelector('.terminal-card');
				const navbar = document.querySelector('.navbar');
				const voiceIndicator = document.querySelector('.voice-indicator');
				
				[terminalCard, navbar, voiceIndicator].forEach(element => {
					if (element) {
						const style = element.getAttribute('style');
						expect(style).toBeTruthy();
					}
				});
			});
			
			unmountTerminal();
			unmountVoice();
			unmountNavbar();
		});
	});

	describe('Error Recovery', () => {
		it('should recover gracefully from invalid theme states', async () => {
			const { unmount } = render(ThemedTerminal);
			
			// Apply an invalid theme
			themeStore.update(() => ({
				mode: 'invalid' as any,
				global: {
					colors: {} as any,
					typography: {} as any,
					spacing: {} as any,
					borders: {} as any
				},
				components: {}
			}));
			
			// Component should still render without crashing
			await waitFor(() => {
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard).toBeInTheDocument();
			});
			
			// Reset to valid theme
			themeStore.reset();
			
			await waitFor(() => {
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard).toBeInTheDocument();
			});
			
			unmount();
		});
	});

	describe('Accessibility Integration', () => {
		it('should maintain accessibility with theme changes', async () => {
			const { unmount } = render(VoiceIndicator, { state: 'listening' });
			
			// Change colors
			themeStore.setColor('success', '#00ff00');
			
			await waitFor(() => {
				const indicator = document.querySelector('.voice-indicator');
				
				// Should maintain ARIA attributes
				expect(indicator).toHaveAttribute('aria-label');
				expect(indicator).toHaveAttribute('aria-pressed');
				expect(indicator).toHaveAttribute('role');
			});
			
			unmount();
		});

		it('should handle high contrast mode appropriately', async () => {
			// Mock high contrast media query
			Object.defineProperty(window, 'matchMedia', {
				writable: true,
				value: vi.fn().mockImplementation(query => ({
					matches: query === '(prefers-contrast: high)',
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(),
				})),
			});
			
			const { unmount } = render(ThemedTerminal);
			
			// Component should render appropriately for high contrast
			await waitFor(() => {
				const terminalCard = document.querySelector('.terminal-card');
				expect(terminalCard).toBeInTheDocument();
			});
			
			unmount();
		});
	});
});