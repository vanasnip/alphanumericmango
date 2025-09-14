import type { MockCommand } from './types.js';

export const mockCommands: Record<string, MockCommand> = {
	help: {
		name: 'help',
		description: 'Show available commands',
		handler: () => [
			'Available commands:',
			'  help     - Show this help message',
			'  date     - Show current date',
			'  time     - Show current time',
			'  status   - Show system status',
			'  clear    - Clear terminal output',
			'  whoami   - Show current user',
			'  uptime   - Show system uptime',
			'  echo     - Echo back input text'
		]
	},
	date: {
		name: 'date',
		description: 'Show current date',
		handler: () => new Date().toDateString()
	},
	time: {
		name: 'time',
		description: 'Show current time',
		handler: () => new Date().toLocaleTimeString()
	},
	status: {
		name: 'status',
		description: 'Show system status',
		handler: () => [
			'System Status: Online',
			'Voice Recognition: Active',
			'Terminal: Ready',
			'Memory Usage: 42%',
			'CPU Usage: 15%'
		]
	},
	clear: {
		name: 'clear',
		description: 'Clear terminal output',
		handler: () => '' // Special case handled in component
	},
	whoami: {
		name: 'whoami',
		description: 'Show current user',
		handler: () => 'voice-terminal-user'
	},
	uptime: {
		name: 'uptime',
		description: 'Show system uptime',
		handler: () => {
			const uptime = Math.floor(Math.random() * 86400); // Random uptime in seconds
			const hours = Math.floor(uptime / 3600);
			const minutes = Math.floor((uptime % 3600) / 60);
			return `up ${hours} hours, ${minutes} minutes`;
		}
	},
	echo: {
		name: 'echo',
		description: 'Echo back input text',
		handler: () => 'Usage: echo <text>'
	}
};

export function processCommand(input: string): { output: string | string[]; type: 'success' | 'error' | 'info' } {
	const trimmed = input.trim().toLowerCase();
	const parts = trimmed.split(' ');
	const command = parts[0];
	const args = parts.slice(1);

	if (!command) {
		return { output: '', type: 'info' };
	}

	if (command === 'echo' && args.length > 0) {
		return { output: args.join(' '), type: 'success' };
	}

	if (mockCommands[command]) {
		if (command === 'clear') {
			return { output: 'CLEAR', type: 'info' }; // Special marker for clearing
		}
		return { output: mockCommands[command].handler(), type: 'success' };
	}

	return { output: `Command not found: ${command}. Type 'help' for available commands.`, type: 'error' };
}