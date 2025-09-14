declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Speech Recognition API types
	interface Window {
		SpeechRecognition: typeof SpeechRecognition;
		webkitSpeechRecognition: typeof SpeechRecognition;
	}

	interface SpeechRecognition extends EventTarget {
		continuous: boolean;
		grammars: SpeechGrammarList;
		interimResults: boolean;
		lang: string;
		maxAlternatives: number;
		serviceURI: string;
		
		start(): void;
		stop(): void;
		abort(): void;
		
		onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
		onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
		onend: ((this: SpeechRecognition, ev: Event) => any) | null;
		onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
		onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
		onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
		onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
		onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
		onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
		onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
		onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
	}

	interface SpeechRecognitionEvent extends Event {
		readonly resultIndex: number;
		readonly results: SpeechRecognitionResultList;
	}

	interface SpeechRecognitionErrorEvent extends Event {
		readonly error: string;
		readonly message: string;
	}

	interface SpeechRecognitionResultList {
		readonly length: number;
		item(index: number): SpeechRecognitionResult;
		[index: number]: SpeechRecognitionResult;
	}

	interface SpeechRecognitionResult {
		readonly isFinal: boolean;
		readonly length: number;
		item(index: number): SpeechRecognitionAlternative;
		[index: number]: SpeechRecognitionAlternative;
	}

	interface SpeechRecognitionAlternative {
		readonly transcript: string;
		readonly confidence: number;
	}

	interface SpeechGrammarList {
		readonly length: number;
		addFromString(string: string, weight?: number): void;
		addFromURI(src: string, weight?: number): void;
		item(index: number): SpeechGrammar;
		[index: number]: SpeechGrammar;
	}

	interface SpeechGrammar {
		src: string;
		weight: number;
	}

	const SpeechRecognition: {
		prototype: SpeechRecognition;
		new (): SpeechRecognition;
	};
}

export {};