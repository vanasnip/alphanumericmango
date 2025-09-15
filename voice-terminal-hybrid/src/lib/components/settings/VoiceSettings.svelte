<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		Card, 
		Label, 
		Range, 
		Toggle, 
		Select,
		Button,
		Alert,
		Progress,
		Listgroup,
		ListgroupItem
	} from 'flowbite-svelte';
	import { 
		MicrophoneIcon,
		SpeakerWaveIcon,
		ExclamationTriangleIcon,
		CheckCircleIcon,
		PlayIcon,
		StopIcon
	} from 'flowbite-svelte-icons';
	import { createEventDispatcher } from 'svelte';
	import VoiceIndicator from '../themed/VoiceIndicator.svelte';

	const dispatch = createEventDispatcher();

	// Voice settings state
	let voiceEnabled = true;
	let speechRecognitionLang = 'en-US';
	let confidenceThreshold = 0.7;
	let speechSynthesisVoice = '';
	let speechRate = 1.0;
	let speechPitch = 1.0;
	let speechVolume = 1.0;
	let autoExecuteCommands = true;
	let voiceActivation = false;
	let noiseReduction = true;
	
	// Testing state
	let isTesting = false;
	let testResult = null;
	let availableVoices = [];
	let availableLanguages = [
		{ code: 'en-US', name: 'English (US)' },
		{ code: 'en-GB', name: 'English (UK)' },
		{ code: 'es-ES', name: 'Spanish (Spain)' },
		{ code: 'fr-FR', name: 'French (France)' },
		{ code: 'de-DE', name: 'German (Germany)' },
		{ code: 'it-IT', name: 'Italian (Italy)' },
		{ code: 'pt-BR', name: 'Portuguese (Brazil)' },
		{ code: 'ru-RU', name: 'Russian (Russia)' },
		{ code: 'ja-JP', name: 'Japanese (Japan)' },
		{ code: 'ko-KR', name: 'Korean (South Korea)' },
		{ code: 'zh-CN', name: 'Chinese (Simplified)' }
	];

	// Audio permission state
	let hasPermission = false;
	let permissionStatus = 'unknown';
	let isCheckingPermission = false;

	onMount(async () => {
		await loadVoiceSettings();
		await checkVoiceSupport();
		await checkAudioPermission();
		loadAvailableVoices();
	});

	async function loadVoiceSettings() {
		// Load from localStorage or API
		try {
			const stored = localStorage.getItem('voice-terminal-voice-settings');
			if (stored) {
				const settings = JSON.parse(stored);
				voiceEnabled = settings.voiceEnabled ?? true;
				speechRecognitionLang = settings.speechRecognitionLang ?? 'en-US';
				confidenceThreshold = settings.confidenceThreshold ?? 0.7;
				speechSynthesisVoice = settings.speechSynthesisVoice ?? '';
				speechRate = settings.speechRate ?? 1.0;
				speechPitch = settings.speechPitch ?? 1.0;
				speechVolume = settings.speechVolume ?? 1.0;
				autoExecuteCommands = settings.autoExecuteCommands ?? true;
				voiceActivation = settings.voiceActivation ?? false;
				noiseReduction = settings.noiseReduction ?? true;
			}
		} catch (error) {
			console.warn('Failed to load voice settings:', error);
		}
	}

	async function saveVoiceSettings() {
		try {
			const settings = {
				voiceEnabled,
				speechRecognitionLang,
				confidenceThreshold,
				speechSynthesisVoice,
				speechRate,
				speechPitch,
				speechVolume,
				autoExecuteCommands,
				voiceActivation,
				noiseReduction
			};
			
			localStorage.setItem('voice-terminal-voice-settings', JSON.stringify(settings));
			dispatch('change', { voiceSettings: settings });
		} catch (error) {
			dispatch('error', { error: 'Failed to save voice settings' });
		}
	}

	async function checkVoiceSupport() {
		const speechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
		const speechSynthesisSupported = 'speechSynthesis' in window;
		
		if (!speechRecognitionSupported || !speechSynthesisSupported) {
			dispatch('error', { 
				error: 'Voice features are not fully supported in this browser' 
			});
		}
	}

	async function checkAudioPermission() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			permissionStatus = 'unsupported';
			return;
		}

		isCheckingPermission = true;
		
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			hasPermission = true;
			permissionStatus = 'granted';
			stream.getTracks().forEach(track => track.stop());
		} catch (error) {
			hasPermission = false;
			permissionStatus = error.name === 'NotAllowedError' ? 'denied' : 'error';
		} finally {
			isCheckingPermission = false;
		}
	}

	function loadAvailableVoices() {
		if ('speechSynthesis' in window) {
			const updateVoices = () => {
				availableVoices = speechSynthesis.getVoices().map(voice => ({
					value: `${voice.name}|${voice.lang}`,
					name: `${voice.name} (${voice.lang})`,
					lang: voice.lang,
					isDefault: voice.default
				}));
				
				// Auto-select default voice if none selected
				if (!speechSynthesisVoice && availableVoices.length > 0) {
					const defaultVoice = availableVoices.find(v => v.isDefault) || availableVoices[0];
					speechSynthesisVoice = defaultVoice.value;
				}
			};

			updateVoices();
			speechSynthesis.onvoiceschanged = updateVoices;
		}
	}

	async function testVoiceRecognition() {
		isTesting = true;
		testResult = null;

		try {
			if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
				throw new Error('Speech recognition not supported');
			}

			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			const recognition = new SpeechRecognition();
			
			recognition.lang = speechRecognitionLang;
			recognition.continuous = false;
			recognition.interimResults = false;

			recognition.onresult = (event) => {
				const result = event.results[0][0];
				testResult = {
					success: true,
					transcript: result.transcript,
					confidence: result.confidence
				};
				isTesting = false;
			};

			recognition.onerror = (event) => {
				testResult = {
					success: false,
					error: event.error
				};
				isTesting = false;
			};

			recognition.onend = () => {
				if (isTesting) {
					testResult = {
						success: false,
						error: 'No speech detected'
					};
					isTesting = false;
				}
			};

			recognition.start();
			
			// Timeout after 5 seconds
			setTimeout(() => {
				if (isTesting) {
					recognition.stop();
					testResult = {
						success: false,
						error: 'Test timed out'
					};
					isTesting = false;
				}
			}, 5000);

		} catch (error) {
			testResult = {
				success: false,
				error: error.message
			};
			isTesting = false;
		}
	}

	function testSpeechSynthesis() {
		if (!('speechSynthesis' in window)) {
			dispatch('error', { error: 'Speech synthesis not supported' });
			return;
		}

		const utterance = new SpeechSynthesisUtterance('Voice test successful. Speech synthesis is working correctly.');
		
		if (speechSynthesisVoice) {
			const [voiceName, voiceLang] = speechSynthesisVoice.split('|');
			const voice = speechSynthesis.getVoices().find(v => 
				v.name === voiceName && v.lang === voiceLang
			);
			if (voice) {
				utterance.voice = voice;
			}
		}
		
		utterance.rate = speechRate;
		utterance.pitch = speechPitch;
		utterance.volume = speechVolume;
		
		speechSynthesis.speak(utterance);
	}

	async function requestPermission() {
		await checkAudioPermission();
	}

	// Reactive save
	$: {
		if (typeof window !== 'undefined') {
			saveVoiceSettings();
		}
	}
</script>

<div class="voice-settings-container space-y-6">
	<!-- Permission Check -->
	{#if permissionStatus !== 'granted'}
		<Alert color={permissionStatus === 'denied' ? 'red' : 'yellow'}>
			<ExclamationTriangleIcon slot="icon" class="w-4 h-4" />
			<span class="font-medium">Microphone Permission Required</span>
			<div class="mt-2">
				{#if permissionStatus === 'denied'}
					<p class="text-sm">Microphone access has been denied. Please enable it in your browser settings.</p>
				{:else if permissionStatus === 'unsupported'}
					<p class="text-sm">Microphone access is not supported in this browser.</p>
				{:else}
					<p class="text-sm">Voice features require microphone permission to function properly.</p>
					<Button 
						size="xs" 
						color="alternative" 
						class="mt-2"
						on:click={requestPermission}
						disabled={isCheckingPermission}
					>
						{isCheckingPermission ? 'Checking...' : 'Grant Permission'}
					</Button>
				{/if}
			</div>
		</Alert>
	{/if}

	<!-- Basic Voice Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Voice Recognition
		</h3>
		
		<div class="space-y-4">
			<!-- Enable Voice -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Enable Voice Input</Label>
					<p class="text-xs text-gray-500 mt-1">Allow voice commands and dictation</p>
				</div>
				<Toggle bind:checked={voiceEnabled} />
			</div>

			<!-- Language -->
			<div>
				<Label for="speech-lang" class="mb-2 block">Recognition Language</Label>
				<Select
					id="speech-lang"
					bind:value={speechRecognitionLang}
					disabled={!voiceEnabled}
					class="w-full"
				>
					{#each availableLanguages as lang (lang.code)}
						<option value={lang.code}>{lang.name}</option>
					{/each}
				</Select>
			</div>

			<!-- Confidence Threshold -->
			<div>
				<Label for="confidence" class="mb-2 block">
					Confidence Threshold: {Math.round(confidenceThreshold * 100)}%
				</Label>
				<Range
					id="confidence"
					min="0.1"
					max="1.0"
					step="0.05"
					bind:value={confidenceThreshold}
					disabled={!voiceEnabled}
					class="w-full"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Minimum confidence level required to accept voice input
				</p>
			</div>

			<!-- Auto Execute -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Auto-execute Commands</Label>
					<p class="text-xs text-gray-500 mt-1">Automatically run recognized voice commands</p>
				</div>
				<Toggle bind:checked={autoExecuteCommands} disabled={!voiceEnabled} />
			</div>

			<!-- Voice Activation -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Voice Activation</Label>
					<p class="text-xs text-gray-500 mt-1">Start listening with a wake word</p>
				</div>
				<Toggle bind:checked={voiceActivation} disabled={!voiceEnabled} />
			</div>

			<!-- Noise Reduction -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Noise Reduction</Label>
					<p class="text-xs text-gray-500 mt-1">Reduce background noise interference</p>
				</div>
				<Toggle bind:checked={noiseReduction} disabled={!voiceEnabled} />
			</div>
		</div>
	</Card>

	<!-- Speech Synthesis Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Speech Output
		</h3>
		
		<div class="space-y-4">
			<!-- Voice Selection -->
			<div>
				<Label for="synthesis-voice" class="mb-2 block">Voice</Label>
				<Select
					id="synthesis-voice"
					bind:value={speechSynthesisVoice}
					disabled={!voiceEnabled}
					class="w-full"
				>
					<option value="">Default Voice</option>
					{#each availableVoices as voice (voice.value)}
						<option value={voice.value}>{voice.name}</option>
					{/each}
				</Select>
			</div>

			<!-- Speech Rate -->
			<div>
				<Label for="speech-rate" class="mb-2 block">
					Speech Rate: {speechRate.toFixed(1)}x
				</Label>
				<Range
					id="speech-rate"
					min="0.1"
					max="3.0"
					step="0.1"
					bind:value={speechRate}
					disabled={!voiceEnabled}
					class="w-full"
				/>
			</div>

			<!-- Speech Pitch -->
			<div>
				<Label for="speech-pitch" class="mb-2 block">
					Speech Pitch: {speechPitch.toFixed(1)}
				</Label>
				<Range
					id="speech-pitch"
					min="0.1"
					max="2.0"
					step="0.1"
					bind:value={speechPitch}
					disabled={!voiceEnabled}
					class="w-full"
				/>
			</div>

			<!-- Speech Volume -->
			<div>
				<Label for="speech-volume" class="mb-2 block">
					Speech Volume: {Math.round(speechVolume * 100)}%
				</Label>
				<Range
					id="speech-volume"
					min="0.0"
					max="1.0"
					step="0.05"
					bind:value={speechVolume}
					disabled={!voiceEnabled}
					class="w-full"
				/>
			</div>
		</div>
	</Card>

	<!-- Voice Testing -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Voice Testing
		</h3>
		
		<div class="space-y-4">
			<!-- Recognition Test -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<Label class="text-sm font-medium">Speech Recognition Test</Label>
					<Button
						size="sm"
						color={isTesting ? 'red' : 'primary'}
						disabled={!voiceEnabled || !hasPermission}
						on:click={testVoiceRecognition}
						class="flex items-center gap-2"
					>
						{#if isTesting}
							<VoiceIndicator state="listening" size="xs" />
							Stop Test
						{:else}
							<MicrophoneIcon class="w-4 h-4" />
							Test Recognition
						{/if}
					</Button>
				</div>
				
				{#if isTesting}
					<Alert color="blue">
						<MicrophoneIcon slot="icon" class="w-4 h-4" />
						<span class="font-medium">Listening...</span>
						<p class="text-sm mt-1">Say something to test voice recognition</p>
						<Progress value={100} class="mt-2" striped />
					</Alert>
				{/if}
				
				{#if testResult}
					<Alert color={testResult.success ? 'green' : 'red'}>
						{#if testResult.success}
							<CheckCircleIcon slot="icon" class="w-4 h-4" />
							<span class="font-medium">Recognition Successful</span>
							<div class="mt-2 text-sm">
								<p><strong>Transcript:</strong> "{testResult.transcript}"</p>
								<p><strong>Confidence:</strong> {Math.round(testResult.confidence * 100)}%</p>
							</div>
						{:else}
							<ExclamationTriangleIcon slot="icon" class="w-4 h-4" />
							<span class="font-medium">Recognition Failed</span>
							<p class="text-sm mt-1">{testResult.error}</p>
						{/if}
					</Alert>
				{/if}
			</div>

			<!-- Synthesis Test -->
			<div>
				<div class="flex items-center justify-between">
					<Label class="text-sm font-medium">Speech Synthesis Test</Label>
					<Button
						size="sm"
						color="primary"
						disabled={!voiceEnabled}
						on:click={testSpeechSynthesis}
						class="flex items-center gap-2"
					>
						<SpeakerWaveIcon class="w-4 h-4" />
						Test Speech
					</Button>
				</div>
			</div>
		</div>
	</Card>

	<!-- Voice Commands Help -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Voice Command Examples
		</h3>
		
		<Listgroup class="space-y-0">
			<ListgroupItem class="text-sm">
				<strong>"help"</strong> - Show available commands
			</ListgroupItem>
			<ListgroupItem class="text-sm">
				<strong>"clear"</strong> - Clear the terminal
			</ListgroupItem>
			<ListgroupItem class="text-sm">
				<strong>"list files"</strong> - Show directory contents
			</ListgroupItem>
			<ListgroupItem class="text-sm">
				<strong>"change theme"</strong> - Open theme settings
			</ListgroupItem>
			<ListgroupItem class="text-sm">
				<strong>"what time is it"</strong> - Show current time
			</ListgroupItem>
		</Listgroup>
	</Card>
</div>

<style>
	.voice-settings-container :global(.range-slider) {
		margin: 0.5rem 0;
	}
	
	.voice-settings-container :global(.toggle) {
		flex-shrink: 0;
	}
</style>