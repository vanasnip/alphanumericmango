export class TextToSpeech {
	private synthesis: SpeechSynthesis | null = null;
	private voice: SpeechSynthesisVoice | null = null;
	private isSupported = false;
	private isSpeaking = false;

	constructor() {
		if (typeof window !== 'undefined') {
			this.initializeSpeechSynthesis();
		}
	}

	private initializeSpeechSynthesis() {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			this.synthesis = window.speechSynthesis;
			this.isSupported = true;
			
			// Load voices
			this.loadVoices();
			
			// Some browsers need a voice list change event
			if (this.synthesis.onvoiceschanged !== undefined) {
				this.synthesis.onvoiceschanged = () => this.loadVoices();
			}
		}
	}

	private loadVoices() {
		if (!this.synthesis) return;
		
		const voices = this.synthesis.getVoices();
		
		// Prefer a natural-sounding English voice
		this.voice = voices.find(voice => 
			voice.lang.startsWith('en') && voice.name.includes('Natural')
		) || voices.find(voice => 
			voice.lang.startsWith('en-US')
		) || voices[0];
	}

	/**
	 * Speak the given text
	 */
	speak(text: string, options?: {
		rate?: number;
		pitch?: number;
		volume?: number;
		onEnd?: () => void;
	}) {
		if (!this.synthesis || !this.isSupported || this.isSpeaking) return;

		// Cancel any ongoing speech
		this.synthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(text);
		
		// Set voice if available
		if (this.voice) {
			utterance.voice = this.voice;
		}

		// Apply options
		utterance.rate = options?.rate || 1.1; // Slightly faster for more natural flow
		utterance.pitch = options?.pitch || 1.0;
		utterance.volume = options?.volume || 1.0;

		// Set event handlers
		utterance.onstart = () => {
			this.isSpeaking = true;
		};

		utterance.onend = () => {
			this.isSpeaking = false;
			options?.onEnd?.();
		};

		utterance.onerror = () => {
			this.isSpeaking = false;
			console.error('Speech synthesis error');
		};

		// Speak
		this.synthesis.speak(utterance);
	}

	/**
	 * Stop any ongoing speech
	 */
	stop() {
		if (this.synthesis && this.isSpeaking) {
			this.synthesis.cancel();
			this.isSpeaking = false;
		}
	}

	/**
	 * Check if TTS is supported
	 */
	get supported(): boolean {
		return this.isSupported;
	}

	/**
	 * Check if currently speaking
	 */
	get speaking(): boolean {
		return this.isSpeaking;
	}
}

// Factory function for browser-safe initialization
export function createTextToSpeech(): TextToSpeech | null {
	if (typeof window !== 'undefined') {
		return new TextToSpeech();
	}
	return null;
}