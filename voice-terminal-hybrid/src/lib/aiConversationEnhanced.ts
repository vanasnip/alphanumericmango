import type { ConversationMessage } from './types.js';
import { uiActions } from './uiActions.js';

export class EnhancedAIConversationHandler {
	private conversation: ConversationMessage[] = [];
	private pendingCommand: string | null = null;
	private pendingUIAction: { action: string; params?: any } | null = null;
	private awaitingConfirmation = false;

	/**
	 * Process user speech and determine if it's conversation, command, or UI action
	 */
	processUserInput(transcript: string): {
		type: 'conversation' | 'execute' | 'command' | 'ui-action';
		response: string;
		command?: string;
		uiAction?: { action: string; result: any };
	} {
		const lowerTranscript = transcript.toLowerCase().trim();
		
		// Check for direct execution trigger
		if (lowerTranscript.startsWith('execute')) {
			if (this.pendingCommand) {
				const cmd = this.pendingCommand;
				this.pendingCommand = null;
				return {
					type: 'execute',
					response: `Executing: ${cmd}`,
					command: cmd
				};
			}
			if (this.pendingUIAction) {
				const result = uiActions.executeAction(
					this.pendingUIAction.action, 
					this.pendingUIAction.params
				);
				this.pendingUIAction = null;
				return {
					type: 'ui-action',
					response: result.message,
					uiAction: { action: this.pendingUIAction?.action || '', result }
				};
			}
			return {
				type: 'conversation',
				response: "I don't have anything ready to execute. What would you like me to do?"
			};
		}

		// Check for confirmation responses
		if (this.awaitingConfirmation) {
			if (lowerTranscript.includes('yes') || lowerTranscript.includes('confirm') || lowerTranscript.includes('do it')) {
				this.awaitingConfirmation = false;
				if (this.pendingUIAction) {
					const result = uiActions.executeAction(
						this.pendingUIAction.action,
						this.pendingUIAction.params
					);
					this.pendingUIAction = null;
					return {
						type: 'ui-action',
						response: `Done! ${result.message}`,
						uiAction: { action: this.pendingUIAction?.action || '', result }
					};
				}
			} else if (lowerTranscript.includes('no') || lowerTranscript.includes('cancel')) {
				this.awaitingConfirmation = false;
				this.pendingUIAction = null;
				return {
					type: 'conversation',
					response: "Cancelled. What else can I help you with?"
				};
			}
		}

		// Store conversation
		this.addMessage('user', transcript);

		// Check for UI layout commands
		const uiResponse = this.processUICommands(transcript);
		if (uiResponse) {
			this.addMessage('assistant', uiResponse.response);
			return uiResponse;
		}

		// Generate AI response for other inputs
		const aiResponse = this.generateAIResponse(transcript);
		this.addMessage('assistant', aiResponse.message);

		return {
			type: 'conversation',
			response: aiResponse.message,
			command: aiResponse.suggestedCommand
		};
	}

	/**
	 * Process UI-related voice commands
	 */
	private processUICommands(input: string): any {
		const lowerInput = input.toLowerCase();

		// Layout split commands
		if (lowerInput.includes('split') || lowerInput.includes('layout')) {
			// Vertical split
			if (lowerInput.includes('vertical') || lowerInput.includes('side by side') || lowerInput.includes('left right')) {
				const result = uiActions.executeAction('layout.split.vertical');
				return {
					type: 'ui-action',
					response: "I've changed the layout to vertical split. The terminal and conversation panels are now side by side. Would you like to swap their positions? Just say 'swap panels'.",
					uiAction: { action: 'layout.split.vertical', result }
				};
			}
			
			// Horizontal split
			if (lowerInput.includes('horizontal') || lowerInput.includes('top bottom') || lowerInput.includes('stack')) {
				const result = uiActions.executeAction('layout.split.horizontal');
				return {
					type: 'ui-action',
					response: "I've changed the layout to horizontal split. The panels are now stacked top and bottom. Would you like to swap which one is on top? Just say 'swap panels'.",
					uiAction: { action: 'layout.split.horizontal', result }
				};
			}

			// General split question
			return {
				type: 'conversation',
				response: "I can change the layout for you. Would you like a vertical split (side by side) or horizontal split (top and bottom)? Just say 'vertical split' or 'horizontal split'."
			};
		}

		// Swap panels
		if (lowerInput.includes('swap') && (lowerInput.includes('panel') || lowerInput.includes('position'))) {
			const result = uiActions.executeAction('layout.swap');
			return {
				type: 'ui-action',
				response: "I've swapped the panel positions. The terminal and conversation panels have switched places.",
				uiAction: { action: 'layout.swap', result }
			};
		}

		// Move conversation panel
		if (lowerInput.includes('move') && (lowerInput.includes('conversation') || lowerInput.includes('chat') || lowerInput.includes('assistant'))) {
			if (lowerInput.includes('left')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'left' });
				return {
					type: 'ui-action',
					response: "I've moved the conversation panel to the left side.",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
			if (lowerInput.includes('right')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'right' });
				return {
					type: 'ui-action',
					response: "I've moved the conversation panel to the right side.",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
			if (lowerInput.includes('top')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'top' });
				return {
					type: 'ui-action',
					response: "I've moved the conversation panel to the top.",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
			if (lowerInput.includes('bottom')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'bottom' });
				return {
					type: 'ui-action',
					response: "I've moved the conversation panel to the bottom.",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}

			// Ask for position
			return {
				type: 'conversation',
				response: "Where would you like the conversation panel? You can say 'move conversation to left', 'right', 'top', or 'bottom'."
			};
		}

		// Move terminal
		if (lowerInput.includes('move') && lowerInput.includes('terminal')) {
			// Terminal position is opposite of conversation
			if (lowerInput.includes('left')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'right' });
				return {
					type: 'ui-action',
					response: "I've moved the terminal to the left (conversation is now on the right).",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
			if (lowerInput.includes('right')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'left' });
				return {
					type: 'ui-action',
					response: "I've moved the terminal to the right (conversation is now on the left).",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
			if (lowerInput.includes('top')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'bottom' });
				return {
					type: 'ui-action',
					response: "I've moved the terminal to the top (conversation is now on the bottom).",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
			if (lowerInput.includes('bottom')) {
				const result = uiActions.executeAction('layout.conversation.position', { position: 'top' });
				return {
					type: 'ui-action',
					response: "I've moved the terminal to the bottom (conversation is now on the top).",
					uiAction: { action: 'layout.conversation.position', result }
				};
			}
		}

		// Resize panels
		if (lowerInput.includes('resize') || lowerInput.includes('bigger') || lowerInput.includes('smaller')) {
			if (lowerInput.includes('conversation') && lowerInput.includes('bigger')) {
				const result = uiActions.executeAction('layout.resize', { ratio: 50 });
				return {
					type: 'ui-action',
					response: "I've made the conversation panel larger (50% of the screen).",
					uiAction: { action: 'layout.resize', result }
				};
			}
			if (lowerInput.includes('conversation') && lowerInput.includes('smaller')) {
				const result = uiActions.executeAction('layout.resize', { ratio: 35 });
				return {
					type: 'ui-action',
					response: "I've made the conversation panel smaller (35% of the screen).",
					uiAction: { action: 'layout.resize', result }
				};
			}
			if (lowerInput.includes('terminal') && lowerInput.includes('bigger')) {
				const result = uiActions.executeAction('layout.resize', { ratio: 35 });
				return {
					type: 'ui-action',
					response: "I've made the terminal panel larger (conversation is now 35%).",
					uiAction: { action: 'layout.resize', result }
				};
			}
			if (lowerInput.includes('equal') || lowerInput.includes('half')) {
				const result = uiActions.executeAction('layout.resize', { ratio: 50 });
				return {
					type: 'ui-action',
					response: "I've set both panels to equal size (50/50 split).",
					uiAction: { action: 'layout.resize', result }
				};
			}
		}

		// Reset layout
		if (lowerInput.includes('reset') && lowerInput.includes('layout')) {
			const result = uiActions.executeAction('layout.reset');
			return {
				type: 'ui-action',
				response: "I've reset the layout to default settings (vertical split with conversation on the right at 40%).",
				uiAction: { action: 'layout.reset', result }
			};
		}

		// Clear commands
		if (lowerInput.includes('clear')) {
			if (lowerInput.includes('conversation') || lowerInput.includes('chat')) {
				return {
					type: 'ui-action',
					response: "I'll clear the conversation history. Say 'execute' to confirm.",
					uiAction: { action: 'setting.conversation.clear', result: { pending: true } }
				};
			}
			if (lowerInput.includes('terminal')) {
				return {
					type: 'ui-action',
					response: "I'll clear the terminal output. Say 'execute' to confirm.",
					uiAction: { action: 'setting.terminal.clear', result: { pending: true } }
				};
			}
		}

		// Layout help
		if (lowerInput.includes('layout') && (lowerInput.includes('help') || lowerInput.includes('option'))) {
			return {
				type: 'conversation',
				response: `I can help you customize the layout. Here are some things you can say:
				
• "Split vertically" or "Split horizontally" - Change layout orientation
• "Move conversation to left/right/top/bottom" - Position the chat panel
• "Move terminal to left/right/top/bottom" - Position the terminal
• "Swap panels" - Switch panel positions
• "Make conversation bigger/smaller" - Resize panels
• "Reset layout" - Return to default settings

What would you like to change?`
			};
		}

		return null;
	}

	/**
	 * Generate context-aware AI responses for non-UI commands
	 */
	private generateAIResponse(input: string): { message: string; suggestedCommand?: string } {
		const lowerInput = input.toLowerCase();

		// Terminal command patterns (existing functionality)
		if (lowerInput.includes('list') && lowerInput.includes('files')) {
			this.pendingCommand = 'ls -la';
			return {
				message: "I'll help you list the files. I've prepared 'ls -la'. Say 'execute' to run it.",
				suggestedCommand: 'ls -la'
			};
		}

		if (lowerInput.includes('help')) {
			return {
				message: `I'm your AI terminal assistant. I can help with:

• Terminal commands - Tell me what you want to do
• Layout control - Say "change layout" or "move panels"  
• Voice commands - Just speak naturally
• Execution - Say "execute" to run commands

What would you like to do?`
			};
		}

		// Default response
		return {
			message: `I heard: "${input}". You can ask me to run terminal commands, change the layout, or get help. What would you like to do?`
		};
	}

	/**
	 * Add a message to conversation history
	 */
	private addMessage(role: 'user' | 'assistant', content: string) {
		this.conversation.push({
			id: Math.random().toString(36).substr(2, 9),
			role,
			content,
			timestamp: new Date()
		});

		if (this.conversation.length > 20) {
			this.conversation = this.conversation.slice(-20);
		}
	}

	getConversation(): ConversationMessage[] {
		return this.conversation;
	}

	clearConversation() {
		this.conversation = [];
		this.pendingCommand = null;
		this.pendingUIAction = null;
		this.awaitingConfirmation = false;
	}

	getPendingCommand(): string | null {
		return this.pendingCommand;
	}
}

export const enhancedAIHandler = new EnhancedAIConversationHandler();