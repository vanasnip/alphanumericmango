// Export types
export type { TerminalLine, VoiceRecognitionResult, MockCommand } from './types.js';

// Export utilities
export { processCommand, mockCommands } from './mockCommands.js';
export { voiceRecognition, VoiceRecognition } from './voiceRecognition.js';

// Export components
export { default as Terminal } from './components/Terminal.svelte';