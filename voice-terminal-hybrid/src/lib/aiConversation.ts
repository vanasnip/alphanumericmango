import type { ConversationMessage } from './types.js';

export class AIConversationHandler {
	private conversation: ConversationMessage[] = [];
	private pendingCommand: string | null = null;

	/**
	 * Process user speech and determine if it's a conversation or command execution
	 */
	processUserInput(transcript: string): {
		type: 'conversation' | 'execute' | 'command';
		response: string;
		command?: string;
	} {
		const lowerTranscript = transcript.toLowerCase().trim();
		
		// Check for direct execution trigger
		if (lowerTranscript.startsWith('execute')) {
			const command = lowerTranscript.replace(/^execute\s+/, '');
			if (command) {
				return {
					type: 'execute',
					response: `Executing command: ${command}`,
					command
				};
			}
			// Execute the pending command if no new command specified
			if (this.pendingCommand) {
				const cmd = this.pendingCommand;
				this.pendingCommand = null;
				return {
					type: 'execute',
					response: `Executing: ${cmd}`,
					command: cmd
				};
			}
			return {
				type: 'conversation',
				response: "I don't have a command ready to execute. What would you like me to run?"
			};
		}

		// Store conversation
		this.addMessage('user', transcript);

		// Generate AI response based on the input
		const aiResponse = this.generateAIResponse(transcript);
		this.addMessage('assistant', aiResponse.message);

		return {
			type: 'conversation',
			response: aiResponse.message,
			command: aiResponse.suggestedCommand
		};
	}

	/**
	 * Generate context-aware AI responses
	 */
	private generateAIResponse(input: string): { message: string; suggestedCommand?: string } {
		const lowerInput = input.toLowerCase();

		// Command interpretation patterns
		if (lowerInput.includes('list') && lowerInput.includes('files')) {
			this.pendingCommand = 'ls -la';
			return {
				message: "I'll help you list the files. I've prepared the command 'ls -la' which will show all files including hidden ones with detailed information. Say 'execute' when you're ready to run it.",
				suggestedCommand: 'ls -la'
			};
		}

		if (lowerInput.includes('current') && (lowerInput.includes('directory') || lowerInput.includes('folder'))) {
			this.pendingCommand = 'pwd';
			return {
				message: "I'll check your current directory using 'pwd' (print working directory). Say 'execute' to run this command.",
				suggestedCommand: 'pwd'
			};
		}

		if (lowerInput.includes('git status')) {
			this.pendingCommand = 'git status';
			return {
				message: "I'll check your git repository status. The command 'git status' will show you any changes, staged files, and branch information. Say 'execute' when ready.",
				suggestedCommand: 'git status'
			};
		}

		if (lowerInput.includes('install') && lowerInput.includes('dependencies')) {
			this.pendingCommand = 'npm install';
			return {
				message: "I can install your project dependencies using 'npm install'. This will read your package.json and install all required packages. Say 'execute' to proceed.",
				suggestedCommand: 'npm install'
			};
		}

		if (lowerInput.includes('run') && lowerInput.includes('test')) {
			this.pendingCommand = 'npm test';
			return {
				message: "I'll run your test suite with 'npm test'. This will execute all your project tests. Say 'execute' when you're ready.",
				suggestedCommand: 'npm test'
			};
		}

		if (lowerInput.includes('build') && lowerInput.includes('project')) {
			this.pendingCommand = 'npm run build';
			return {
				message: "I'll build your project using 'npm run build'. This will compile and bundle your application for production. Say 'execute' to start the build.",
				suggestedCommand: 'npm run build'
			};
		}

		// General conversation responses
		if (lowerInput.includes('help')) {
			return {
				message: "I'm your AI terminal assistant. You can talk to me naturally about what you want to do, and I'll help prepare the right commands. When you're ready to run a command, just say 'execute'. For example, try saying 'show me the files in this folder' or 'check my git status'."
			};
		}

		if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
			return {
				message: "Hello! I'm here to help you with terminal commands. Just tell me what you'd like to do, and I'll prepare the appropriate command for you. When you're ready to run it, say 'execute'."
			};
		}

		if (lowerInput.includes('thank')) {
			return {
				message: "You're welcome! Is there anything else you'd like to do? I can help with file operations, git commands, npm tasks, and more."
			};
		}

		// Default response for unrecognized patterns
		return {
			message: `I heard: "${input}". I'm still learning to understand all commands. Try asking me to 'list files', 'check git status', or 'show current directory'. When you want to run a command, say 'execute'.`
		};
	}

	/**
	 * Add a message to the conversation history
	 */
	private addMessage(role: 'user' | 'assistant', content: string) {
		this.conversation.push({
			id: Math.random().toString(36).substr(2, 9),
			role,
			content,
			timestamp: new Date()
		});

		// Keep conversation history manageable
		if (this.conversation.length > 20) {
			this.conversation = this.conversation.slice(-20);
		}
	}

	/**
	 * Get the current conversation history
	 */
	getConversation(): ConversationMessage[] {
		return this.conversation;
	}

	/**
	 * Clear conversation history
	 */
	clearConversation() {
		this.conversation = [];
		this.pendingCommand = null;
	}

	/**
	 * Get the pending command if any
	 */
	getPendingCommand(): string | null {
		return this.pendingCommand;
	}
}

// Export singleton instance
export const aiHandler = new AIConversationHandler();