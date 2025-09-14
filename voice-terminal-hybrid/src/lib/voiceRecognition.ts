import type { VoiceRecognitionResult } from './types.js';

export class VoiceRecognition {
	private recognition: SpeechRecognition | null = null;
	private isSupported = false;
	private isListening = false;

	constructor() {
		// Only initialize in browser environment
		if (typeof window !== 'undefined') {
			this.initializeSpeechRecognition();
		}
	}

	private initializeSpeechRecognition() {
		if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
			const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
			this.recognition = new SpeechRecognition();
			this.isSupported = true;

			// Configure recognition settings
			this.recognition.continuous = false;
			this.recognition.interimResults = true;
			this.recognition.lang = 'en-US';
			this.recognition.maxAlternatives = 1;
		}
	}

	get supported() {
		return this.isSupported;
	}

	get listening() {
		return this.isListening;
	}

	start(
		onResult: (result: VoiceRecognitionResult) => void,
		onError: (error: string) => void,
		onEnd: () => void
	) {
		if (!this.recognition || this.isListening) return;

		this.isListening = true;

		this.recognition.onresult = (event) => {
			const last = event.results.length - 1;
			const result = event.results[last];
			
			onResult({
				transcript: result[0].transcript,
				confidence: result[0].confidence,
				isFinal: result.isFinal
			});
		};

		this.recognition.onerror = (event) => {
			let errorMessage = 'Voice recognition error';
			switch(event.error) {
				case 'no-speech':
					errorMessage = 'No speech detected. Please try again.';
					break;
				case 'audio-capture':
					errorMessage = 'No microphone found or microphone access denied.';
					break;
				case 'not-allowed':
					errorMessage = 'Microphone access denied. Please allow microphone access.';
					break;
				case 'network':
					errorMessage = 'Network error. Please check your connection.';
					break;
				default:
					errorMessage = `Voice recognition error: ${event.error}`;
			}
			onError(errorMessage);
			this.isListening = false;
		};

		this.recognition.onend = () => {
			this.isListening = false;
			onEnd();
		};

		try {
			this.recognition.start();
		} catch (error) {
			onError('Failed to start voice recognition');
			this.isListening = false;
		}
	}

	stop() {
		if (this.recognition && this.isListening) {
			this.recognition.stop();
		}
	}
}

// Create factory function instead of global instance
export function createVoiceRecognition(): VoiceRecognition | null {
	if (typeof window !== 'undefined') {
		return new VoiceRecognition();
	}
	return null;
}