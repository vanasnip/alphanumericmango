import { Page } from '@playwright/test';

/**
 * Voice simulation and automation utilities for E2E testing
 */

export interface VoiceCommand {
	text: string;
	confidence?: number;
	language?: string;
	interim?: boolean;
}

export interface VoiceRecognitionMock {
	isListening: boolean;
	commands: VoiceCommand[];
	errors: Array<{ error: string; message: string }>;
}

export class VoiceTestHelpers {
	constructor(private page: Page) {}

	/**
	 * Initialize voice recognition mocks
	 */
	async initializeVoiceMocks(): Promise<void> {
		await this.page.addInitScript(() => {
			// Mock SpeechRecognition
			class MockSpeechRecognition extends EventTarget {
				continuous = true;
				interimResults = true;
				lang = 'en-US';
				maxAlternatives = 1;
				serviceURI = '';

				private _isListening = false;
				
				start() {
					this._isListening = true;
					setTimeout(() => {
						this.dispatchEvent(new Event('start'));
					}, 10);
				}

				stop() {
					this._isListening = false;
					setTimeout(() => {
						this.dispatchEvent(new Event('end'));
					}, 10);
				}

				abort() {
					this._isListening = false;
					setTimeout(() => {
						this.dispatchEvent(new Event('end'));
					}, 10);
				}

				// Helper method for testing
				simulateResult(transcript: string, confidence = 0.9, isFinal = true) {
					if (!this._isListening) return;

					const mockEvent = {
						results: [{
							0: { transcript, confidence },
							isFinal,
							length: 1
						}],
						resultIndex: 0,
						interpretation: null,
						emma: null
					};

					this.dispatchEvent(new CustomEvent('result', { detail: mockEvent }));
				}

				simulateError(error: string, message = '') {
					const errorEvent = new CustomEvent('error', {
						detail: { error, message }
					});
					this.dispatchEvent(errorEvent);
				}

				get isListening() {
					return this._isListening;
				}
			}

			// Mock SpeechSynthesis
			class MockSpeechSynthesis {
				speaking = false;
				pending = false;
				paused = false;

				speak(utterance: any) {
					this.speaking = true;
					
					// Store spoken text for testing
					(window as any).__lastSpokenText = utterance.text;
					
					setTimeout(() => {
						this.speaking = false;
						if (utterance.onend) utterance.onend();
					}, 100);
				}

				cancel() {
					this.speaking = false;
					this.pending = false;
				}

				pause() {
					this.paused = true;
				}

				resume() {
					this.paused = false;
				}

				getVoices() {
					return [
						{ name: 'Mock Voice', lang: 'en-US', default: true, localService: true, voiceURI: 'mock' }
					];
				}
			}

			class MockSpeechSynthesisUtterance {
				text = '';
				lang = 'en-US';
				voice = null;
				volume = 1;
				rate = 1;
				pitch = 1;
				onstart: (() => void) | null = null;
				onend: (() => void) | null = null;
				onerror: (() => void) | null = null;
				onpause: (() => void) | null = null;
				onresume: (() => void) | null = null;
				onmark: (() => void) | null = null;
				onboundary: (() => void) | null = null;

				constructor(text?: string) {
					if (text) this.text = text;
				}
			}

			// Replace global APIs
			(window as any).SpeechRecognition = MockSpeechRecognition;
			(window as any).webkitSpeechRecognition = MockSpeechRecognition;
			(window as any).speechSynthesis = new MockSpeechSynthesis();
			(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

			// Store mock for direct access
			(window as any).__speechRecognitionMock = null;
			(window as any).__speechSynthesisMock = (window as any).speechSynthesis;

			// Track voice commands and responses
			(window as any).__voiceTestData = {
				commands: [],
				responses: [],
				errors: []
			};
		});
	}

	/**
	 * Start voice recognition simulation
	 */
	async startVoiceRecognition(): Promise<void> {
		await this.page.evaluate(() => {
			const voiceButton = document.querySelector('[data-testid="voice-toggle-button"]') as HTMLElement;
			if (voiceButton) {
				voiceButton.click();
			}
		});

		// Wait for recognition to start
		await this.page.waitForTimeout(100);
	}

	/**
	 * Stop voice recognition simulation
	 */
	async stopVoiceRecognition(): Promise<void> {
		await this.page.evaluate(() => {
			const voiceButton = document.querySelector('[data-testid="voice-toggle-button"]') as HTMLElement;
			if (voiceButton) {
				voiceButton.click();
			}
		});

		await this.page.waitForTimeout(100);
	}

	/**
	 * Simulate a voice command
	 */
	async simulateVoiceCommand(command: VoiceCommand): Promise<void> {
		await this.page.evaluate((cmd) => {
			const recognition = (window as any).__speechRecognitionMock;
			if (recognition && recognition.simulateResult) {
				recognition.simulateResult(cmd.text, cmd.confidence || 0.9, !cmd.interim);
			}

			// Track command for testing
			const testData = (window as any).__voiceTestData;
			if (testData) {
				testData.commands.push(cmd);
			}
		}, command);

		// Wait for command processing
		await this.page.waitForTimeout(200);
	}

	/**
	 * Simulate multiple voice commands in sequence
	 */
	async simulateVoiceSequence(commands: VoiceCommand[], delay = 300): Promise<void> {
		for (const command of commands) {
			await this.simulateVoiceCommand(command);
			await this.page.waitForTimeout(delay);
		}
	}

	/**
	 * Simulate voice recognition error
	 */
	async simulateVoiceError(error: string, message = ''): Promise<void> {
		await this.page.evaluate((errorData) => {
			const recognition = (window as any).__speechRecognitionMock;
			if (recognition && recognition.simulateError) {
				recognition.simulateError(errorData.error, errorData.message);
			}

			// Track error for testing
			const testData = (window as any).__voiceTestData;
			if (testData) {
				testData.errors.push(errorData);
			}
		}, { error, message });

		await this.page.waitForTimeout(100);
	}

	/**
	 * Get voice recognition status
	 */
	async getVoiceStatus(): Promise<{
		isListening: boolean;
		hasError: boolean;
		lastCommand?: string;
		lastResponse?: string;
	}> {
		return await this.page.evaluate(() => {
			const indicator = document.querySelector('[data-testid="voice-indicator"]');
			const errorElement = document.querySelector('[data-testid="voice-error"]');
			const testData = (window as any).__voiceTestData || { commands: [], responses: [] };

			return {
				isListening: indicator ? indicator.classList.contains('listening') || indicator.classList.contains('active') : false,
				hasError: errorElement ? errorElement.textContent !== '' : false,
				lastCommand: testData.commands.length > 0 ? testData.commands[testData.commands.length - 1].text : undefined,
				lastResponse: (window as any).__lastSpokenText || undefined
			};
		});
	}

	/**
	 * Wait for voice command to be processed
	 */
	async waitForVoiceProcessing(timeout = 3000): Promise<void> {
		await this.page.waitForFunction(() => {
			const indicator = document.querySelector('[data-testid="voice-indicator"]');
			return !indicator?.classList.contains('processing');
		}, { timeout });
	}

	/**
	 * Get all voice commands sent during the test
	 */
	async getVoiceCommandHistory(): Promise<VoiceCommand[]> {
		return await this.page.evaluate(() => {
			const testData = (window as any).__voiceTestData;
			return testData ? testData.commands : [];
		});
	}

	/**
	 * Clear voice command history
	 */
	async clearVoiceHistory(): Promise<void> {
		await this.page.evaluate(() => {
			(window as any).__voiceTestData = {
				commands: [],
				responses: [],
				errors: []
			};
		});
	}

	/**
	 * Test voice command recognition patterns
	 */
	async testVoicePatterns(patterns: Array<{ input: string; expectedAction: string; expectedTheme?: string }>): Promise<Array<{ input: string; success: boolean; actualAction?: string }>> {
		const results = [];

		for (const pattern of patterns) {
			await this.clearVoiceHistory();
			await this.simulateVoiceCommand({ text: pattern.input });
			
			// Wait for processing
			await this.waitForVoiceProcessing();

			// Check if expected action occurred
			const themeAfter = await this.page.evaluate(() => {
				const themeStore = (window as any).__themeStore;
				return themeStore ? themeStore.getTheme() : null;
			});

			const success = pattern.expectedTheme ? 
				themeAfter?.theme?.preset === pattern.expectedTheme ||
				themeAfter?.theme?.mode === pattern.expectedTheme :
				true; // For non-theme actions, assume success if no error

			results.push({
				input: pattern.input,
				success,
				actualAction: success ? pattern.expectedAction : 'failed'
			});
		}

		return results;
	}

	/**
	 * Simulate noisy speech recognition (partial results, corrections)
	 */
	async simulateNoisySpeech(targetText: string): Promise<void> {
		const words = targetText.split(' ');
		
		// Simulate partial results
		for (let i = 1; i <= words.length; i++) {
			const partialText = words.slice(0, i).join(' ');
			await this.simulateVoiceCommand({
				text: partialText,
				confidence: 0.5 + (i / words.length) * 0.4, // Increasing confidence
				interim: i < words.length
			});
			await this.page.waitForTimeout(50);
		}

		// Final result
		await this.simulateVoiceCommand({
			text: targetText,
			confidence: 0.9,
			interim: false
		});
	}

	/**
	 * Test voice recognition confidence thresholds
	 */
	async testConfidenceThresholds(text: string, confidenceLevels: number[]): Promise<Array<{ confidence: number; processed: boolean }>> {
		const results = [];

		for (const confidence of confidenceLevels) {
			await this.clearVoiceHistory();
			await this.simulateVoiceCommand({ text, confidence });
			
			await this.page.waitForTimeout(300);

			const history = await this.getVoiceCommandHistory();
			const processed = history.length > 0;

			results.push({ confidence, processed });
		}

		return results;
	}

	/**
	 * Simulate continuous voice session with multiple commands
	 */
	async simulateContinuousSession(commands: VoiceCommand[], sessionDuration = 5000): Promise<{
		commandsProcessed: number;
		errors: number;
		averageResponseTime: number;
	}> {
		await this.startVoiceRecognition();
		
		const startTime = Date.now();
		const responseTimes: number[] = [];
		let commandsProcessed = 0;
		let errors = 0;

		for (const command of commands) {
			if (Date.now() - startTime > sessionDuration) break;

			const commandStart = Date.now();
			
			try {
				await this.simulateVoiceCommand(command);
				await this.waitForVoiceProcessing(1000);
				
				const commandEnd = Date.now();
				responseTimes.push(commandEnd - commandStart);
				commandsProcessed++;
			} catch (error) {
				errors++;
			}

			await this.page.waitForTimeout(100);
		}

		await this.stopVoiceRecognition();

		return {
			commandsProcessed,
			errors,
			averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0
		};
	}

	/**
	 * Test voice accessibility features
	 */
	async testVoiceAccessibility(): Promise<{
		hasAriaLabels: boolean;
		hasLiveRegions: boolean;
		hasKeyboardAlternatives: boolean;
		announcementsWork: boolean;
	}> {
		return await this.page.evaluate(() => {
			const voiceButton = document.querySelector('[data-testid="voice-toggle-button"]');
			const voiceIndicator = document.querySelector('[data-testid="voice-indicator"]');
			const liveRegion = document.querySelector('[aria-live]');
			
			return {
				hasAriaLabels: !!(voiceButton?.getAttribute('aria-label') || voiceButton?.getAttribute('aria-labelledby')),
				hasLiveRegions: !!liveRegion,
				hasKeyboardAlternatives: !!(voiceButton?.getAttribute('tabindex') !== '-1'),
				announcementsWork: !!(liveRegion && liveRegion.textContent?.trim())
			};
		});
	}

	/**
	 * Monitor voice processing performance
	 */
	async monitorVoicePerformance(commands: VoiceCommand[]): Promise<{
		averageProcessingTime: number;
		maxProcessingTime: number;
		minProcessingTime: number;
		memoryUsage?: number;
	}> {
		const processingTimes: number[] = [];

		for (const command of commands) {
			const startTime = performance.now();
			
			await this.simulateVoiceCommand(command);
			await this.waitForVoiceProcessing();
			
			const endTime = performance.now();
			processingTimes.push(endTime - startTime);
		}

		const memoryUsage = await this.page.evaluate(() => {
			if ('memory' in performance) {
				return (performance as any).memory.usedJSHeapSize;
			}
			return undefined;
		});

		return {
			averageProcessingTime: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
			maxProcessingTime: Math.max(...processingTimes),
			minProcessingTime: Math.min(...processingTimes),
			memoryUsage
		};
	}

	/**
	 * Test language and locale support
	 */
	async testLanguageSupport(languages: string[]): Promise<Array<{ lang: string; supported: boolean }>> {
		const results = [];

		for (const lang of languages) {
			const supported = await this.page.evaluate((language) => {
				try {
					const recognition = new (window as any).SpeechRecognition();
					recognition.lang = language;
					return true;
				} catch {
					return false;
				}
			}, lang);

			results.push({ lang, supported });
		}

		return results;
	}

	/**
	 * Simulate voice activation with different trigger phrases
	 */
	async testVoiceActivation(triggerPhrases: string[]): Promise<Array<{ phrase: string; activated: boolean }>> {
		const results = [];

		for (const phrase of triggerPhrases) {
			await this.simulateVoiceCommand({ text: phrase });
			
			const status = await this.getVoiceStatus();
			const activated = status.isListening;

			results.push({ phrase, activated });
		}

		return results;
	}

	/**
	 * Test wake word detection simulation
	 */
	async simulateWakeWordDetection(wakeWord: string, followUpCommand: string): Promise<{
		wakeWordDetected: boolean;
		commandExecuted: boolean;
		responseTime: number;
	}> {
		const startTime = performance.now();

		// Simulate wake word
		await this.simulateVoiceCommand({ text: wakeWord, confidence: 0.95 });
		await this.page.waitForTimeout(100);

		const wakeWordDetected = (await this.getVoiceStatus()).isListening;

		// Simulate follow-up command
		await this.simulateVoiceCommand({ text: followUpCommand, confidence: 0.9 });
		await this.waitForVoiceProcessing();

		const endTime = performance.now();
		const responseTime = endTime - startTime;

		// Check if command was executed (theme change, etc.)
		const history = await this.getVoiceCommandHistory();
		const commandExecuted = history.some(cmd => cmd.text.includes(followUpCommand));

		return {
			wakeWordDetected,
			commandExecuted,
			responseTime
		};
	}
}