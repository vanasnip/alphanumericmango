export interface TerminalLine {
	id: string;
	type: 'command' | 'output' | 'system';
	content: string;
	timestamp: Date;
	outputType?: 'success' | 'error' | 'info' | 'warning';
	isTyping?: boolean;
}

export interface VoiceRecognitionResult {
	transcript: string;
	confidence: number;
	isFinal: boolean;
}

export interface ConversationMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

export interface MockCommand {
	name: string;
	description: string;
	handler: () => string | string[];
}