export interface VoiceNavigationItem {
	id: string;
	number: number;
	type: 'project' | 'menu' | 'message' | 'command';
	element?: HTMLElement;
	callback?: () => void;
	voiceCommands: string[];
	isActive?: boolean;
	isVisible?: boolean;
}

export interface VoiceNavigationContext {
	contextId: string;
	items: Map<number, VoiceNavigationItem>;
	maxNumber: number;
}

class VoiceNavigationManager {
	private contexts = new Map<string, VoiceNavigationContext>();
	private activeContext = 'default';
	private messageCounter = 1; // For persistent chat message numbering

	constructor() {
		this.createContext('default');
	}

	createContext(contextId: string): void {
		this.contexts.set(contextId, {
			contextId,
			items: new Map(),
			maxNumber: 0
		});
	}

	setActiveContext(contextId: string): void {
		if (this.contexts.has(contextId)) {
			this.activeContext = contextId;
		}
	}

	private getContext(): VoiceNavigationContext {
		return this.contexts.get(this.activeContext)!;
	}

	// Register a navigable item
	registerItem(
		id: string,
		type: VoiceNavigationItem['type'],
		voiceCommands: string[],
		callback?: () => void,
		element?: HTMLElement,
		customNumber?: number
	): number {
		const context = this.getContext();
		
		// For messages, use persistent counter
		let assignedNumber: number;
		if (type === 'message') {
			assignedNumber = customNumber ?? this.messageCounter++;
		} else {
			// For other types, assign next available number in context
			assignedNumber = customNumber ?? (context.maxNumber + 1);
		}

		const item: VoiceNavigationItem = {
			id,
			number: assignedNumber,
			type,
			voiceCommands: [...voiceCommands, assignedNumber.toString()],
			callback,
			element,
			isActive: false,
			isVisible: true
		};

		context.items.set(assignedNumber, item);
		context.maxNumber = Math.max(context.maxNumber, assignedNumber);

		return assignedNumber;
	}

	// Unregister an item
	unregisterItem(number: number): void {
		const context = this.getContext();
		context.items.delete(number);
	}

	// Get all items in current context
	getItems(): VoiceNavigationItem[] {
		const context = this.getContext();
		return Array.from(context.items.values())
			.filter(item => item.isVisible)
			.sort((a, b) => a.number - b.number);
	}

	// Get items by type
	getItemsByType(type: VoiceNavigationItem['type']): VoiceNavigationItem[] {
		return this.getItems().filter(item => item.type === type);
	}

	// Set item active state
	setItemActive(number: number, isActive: boolean): void {
		const context = this.getContext();
		const item = context.items.get(number);
		if (item) {
			item.isActive = isActive;
		}
	}

	// Set item visibility
	setItemVisibility(number: number, isVisible: boolean): void {
		const context = this.getContext();
		const item = context.items.get(number);
		if (item) {
			item.isVisible = isVisible;
		}
	}

	// Process voice commands
	processVoiceCommand(command: string): boolean {
		const normalizedCommand = command.toLowerCase().trim();
		
		// Try direct number first
		const numberMatch = normalizedCommand.match(/^(\d+)$/);
		if (numberMatch) {
			const number = parseInt(numberMatch[1]);
			return this.executeItem(number);
		}

		// Try contextual commands
		const contextualCommands = [
			{ pattern: /^(?:select|go to|click)\s+(\d+)$/i, action: 'select' },
			{ pattern: /^project\s+(\d+)$/i, action: 'project' },
			{ pattern: /^message\s+(\d+)$/i, action: 'message' },
			{ pattern: /^command\s+(\d+)$/i, action: 'command' },
			{ pattern: /^menu\s+(\d+)$/i, action: 'menu' }
		];

		for (const cmd of contextualCommands) {
			const match = normalizedCommand.match(cmd.pattern);
			if (match) {
				const number = parseInt(match[1]);
				return this.executeItem(number, cmd.action);
			}
		}

		// Try exact voice command matches
		const context = this.getContext();
		for (const [number, item] of context.items) {
			if (!item.isVisible) continue;
			
			for (const voiceCommand of item.voiceCommands) {
				if (normalizedCommand === voiceCommand.toLowerCase()) {
					return this.executeItem(number);
				}
			}
		}

		return false;
	}

	// Execute item callback
	private executeItem(number: number, actionType?: string): boolean {
		const context = this.getContext();
		const item = context.items.get(number);
		
		if (!item || !item.isVisible) {
			return false;
		}

		// Type-specific validation
		if (actionType) {
			const typeMap = {
				'project': 'project',
				'message': 'message', 
				'command': 'command',
				'menu': 'menu'
			};
			
			if (typeMap[actionType] && item.type !== typeMap[actionType]) {
				return false;
			}
		}

		// Execute callback or trigger element click
		if (item.callback) {
			item.callback();
		} else if (item.element) {
			item.element.click();
		}

		// Visual feedback
		this.setItemActive(number, true);
		setTimeout(() => this.setItemActive(number, false), 200);

		return true;
	}

	// Get numbered message sequence (for chat)
	getMessageSequence(): { user: number[], assistant: number[] } {
		const messages = this.getItemsByType('message');
		const user: number[] = [];
		const assistant: number[] = [];

		messages.forEach(msg => {
			// Odd numbers for user, even for assistant
			if (msg.number % 2 === 1) {
				user.push(msg.number);
			} else {
				assistant.push(msg.number);
			}
		});

		return { user, assistant };
	}

	// Reset message counter (for clearing conversation)
	resetMessageCounter(): void {
		this.messageCounter = 1;
		// Remove all message items
		const context = this.getContext();
		const messageNumbers = Array.from(context.items.keys())
			.filter(num => context.items.get(num)?.type === 'message');
		
		messageNumbers.forEach(num => context.items.delete(num));
	}

	// Get next message number
	getNextMessageNumber(isUser: boolean): number {
		if (isUser) {
			// User messages get odd numbers
			const nextOdd = this.messageCounter % 2 === 0 ? this.messageCounter + 1 : this.messageCounter;
			this.messageCounter = Math.max(this.messageCounter, nextOdd + 1);
			return nextOdd;
		} else {
			// Assistant messages get even numbers  
			const nextEven = this.messageCounter % 2 === 1 ? this.messageCounter + 1 : this.messageCounter;
			this.messageCounter = Math.max(this.messageCounter, nextEven + 1);
			return nextEven;
		}
	}

	// Debug helper
	debugCurrentState(): void {
		const context = this.getContext();
		console.log(`Active Context: ${this.activeContext}`);
		console.log(`Items:`, Array.from(context.items.values()));
		console.log(`Message Counter: ${this.messageCounter}`);
	}
}

// Global instance
export const voiceNavigation = new VoiceNavigationManager();

// Svelte store integration
import { writable } from 'svelte/store';

export const navigationItems = writable<VoiceNavigationItem[]>([]);

// Update store when items change
setInterval(() => {
	navigationItems.set(voiceNavigation.getItems());
}, 100);