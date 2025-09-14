import { layoutStore } from './stores/layoutStore.js';
import type { LayoutMode, PanelPosition } from './stores/layoutStore.js';

export interface UIAction {
	type: 'layout' | 'theme' | 'setting' | 'navigation';
	action: string;
	parameters?: Record<string, any>;
	description?: string;
}

export interface UIActionResult {
	success: boolean;
	message: string;
	newState?: any;
}

/**
 * UI Actions Registry - Tools that the AI assistant can trigger
 * Similar to MCP tools but for UI manipulation
 */
class UIActionsRegistry {
	private actions: Map<string, (params?: any) => UIActionResult> = new Map();

	constructor() {
		this.registerLayoutActions();
		this.registerSettingActions();
	}

	/**
	 * Register layout-related actions
	 */
	private registerLayoutActions() {
		// Split layout vertically
		this.actions.set('layout.split.vertical', () => {
			layoutStore.setMode('vertical');
			return {
				success: true,
				message: 'Layout changed to vertical split (side-by-side)',
				newState: { mode: 'vertical' }
			};
		});

		// Split layout horizontally
		this.actions.set('layout.split.horizontal', () => {
			layoutStore.setMode('horizontal');
			return {
				success: true,
				message: 'Layout changed to horizontal split (top-bottom)',
				newState: { mode: 'horizontal' }
			};
		});

		// Swap panel positions
		this.actions.set('layout.swap', () => {
			layoutStore.swapPanels();
			return {
				success: true,
				message: 'Panel positions swapped',
				newState: { swapped: true }
			};
		});

		// Move conversation to specific position
		this.actions.set('layout.conversation.position', (params: { position: PanelPosition }) => {
			if (!params?.position) {
				return {
					success: false,
					message: 'Position parameter required (left, right, top, or bottom)'
				};
			}

			const validPositions = ['left', 'right', 'top', 'bottom'];
			if (!validPositions.includes(params.position)) {
				return {
					success: false,
					message: `Invalid position. Choose from: ${validPositions.join(', ')}`
				};
			}

			// Determine mode based on position
			const mode: LayoutMode = params.position === 'left' || params.position === 'right' 
				? 'vertical' 
				: 'horizontal';
			
			layoutStore.setMode(mode);
			
			// Set the correct position
			if (mode === 'vertical') {
				if (params.position === 'left') {
					layoutStore.update(state => ({ ...state, conversationPosition: 'left' }));
				} else {
					layoutStore.update(state => ({ ...state, conversationPosition: 'right' }));
				}
			} else {
				if (params.position === 'top') {
					layoutStore.update(state => ({ ...state, conversationPosition: 'top' }));
				} else {
					layoutStore.update(state => ({ ...state, conversationPosition: 'bottom' }));
				}
			}

			return {
				success: true,
				message: `Conversation panel moved to ${params.position}`,
				newState: { position: params.position, mode }
			};
		});

		// Adjust split ratio
		this.actions.set('layout.resize', (params: { ratio: number }) => {
			if (params?.ratio === undefined) {
				return {
					success: false,
					message: 'Ratio parameter required (30-70)'
				};
			}

			const ratio = params.ratio / 100; // Convert percentage to decimal
			if (ratio < 0.3 || ratio > 0.7) {
				return {
					success: false,
					message: 'Ratio must be between 30 and 70 percent'
				};
			}

			layoutStore.setSplitRatio(ratio);
			return {
				success: true,
				message: `Panel size adjusted to ${params.ratio}% for conversation`,
				newState: { ratio }
			};
		});

		// Reset layout to defaults
		this.actions.set('layout.reset', () => {
			layoutStore.reset();
			return {
				success: true,
				message: 'Layout reset to default settings',
				newState: { reset: true }
			};
		});
	}

	/**
	 * Register setting-related actions
	 */
	private registerSettingActions() {
		// Toggle conversation mode
		this.actions.set('setting.conversation.toggle', () => {
			// This would toggle conversation mode on/off
			return {
				success: true,
				message: 'Conversation mode toggled',
				newState: { conversationMode: true }
			};
		});

		// Clear conversation
		this.actions.set('setting.conversation.clear', () => {
			return {
				success: true,
				message: 'Conversation history cleared',
				newState: { cleared: true }
			};
		});

		// Clear terminal
		this.actions.set('setting.terminal.clear', () => {
			return {
				success: true,
				message: 'Terminal output cleared',
				newState: { cleared: true }
			};
		});
	}

	/**
	 * Execute a UI action
	 */
	executeAction(actionName: string, parameters?: any): UIActionResult {
		const action = this.actions.get(actionName);
		
		if (!action) {
			return {
				success: false,
				message: `Unknown action: ${actionName}. Available actions: ${this.getAvailableActions().join(', ')}`
			};
		}

		try {
			return action(parameters);
		} catch (error) {
			return {
				success: false,
				message: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Get list of available actions
	 */
	getAvailableActions(): string[] {
		return Array.from(this.actions.keys());
	}

	/**
	 * Get help for available actions
	 */
	getActionsHelp(): Record<string, string> {
		return {
			'layout.split.vertical': 'Split the screen vertically (side-by-side)',
			'layout.split.horizontal': 'Split the screen horizontally (top-bottom)',
			'layout.swap': 'Swap the positions of terminal and conversation panels',
			'layout.conversation.position': 'Move conversation to left, right, top, or bottom',
			'layout.resize': 'Resize panels (30-70% range)',
			'layout.reset': 'Reset layout to default settings',
			'setting.conversation.clear': 'Clear conversation history',
			'setting.terminal.clear': 'Clear terminal output'
		};
	}
}

// Export singleton instance
export const uiActions = new UIActionsRegistry();