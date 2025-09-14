<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { TerminalLine, VoiceRecognitionResult } from '../types.js';
	import type { VoiceRecognition } from '../voiceRecognition.js';
	import { processCommand } from '../mockCommands.js';
	import { createVoiceRecognition } from '../voiceRecognition.js';

	let lines: TerminalLine[] = [];
	let currentInput = '';
	let commandHistory: string[] = [];
	let historyIndex = -1;
	let inputElement: HTMLInputElement;
	let outputElement: HTMLDivElement;
	
	// Voice recognition state
	let voiceRecognition: VoiceRecognition | null = null;
	let isRecording = false;
	let currentTranscript = '';
	let transcriptConfidence = 0;
	let voiceError = '';
	let showVoiceStatus = false;
	
	// Initialize voice recognition on mount
	onMount(() => {
		voiceRecognition = createVoiceRecognition();
	});

	function generateId(): string {
		return Math.random().toString(36).substr(2, 9);
	}

	function addLine(content: string, type: 'command' | 'output' | 'system' = 'output', outputType?: 'success' | 'error' | 'info' | 'warning') {
		const newLine: TerminalLine = {
			id: generateId(),
			type,
			content,
			timestamp: new Date(),
			outputType,
			isTyping: type === 'output'
		};
		
		lines = [...lines, newLine];
		scrollToBottom();
		
		// Remove typing effect after animation
		if (type === 'output') {
			setTimeout(() => {
				lines = lines.map(line => 
					line.id === newLine.id ? { ...line, isTyping: false } : line
				);
			}, 1000);
		}
	}

	async function scrollToBottom() {
		await tick();
		if (outputElement) {
			outputElement.scrollTop = outputElement.scrollHeight;
		}
	}

	function executeCommand(command: string) {
		if (!command.trim()) return;

		// Add command to history
		commandHistory = [command, ...commandHistory.slice(0, 49)]; // Keep last 50 commands
		historyIndex = -1;

		// Add command line
		addLine(`$ ${command}`, 'command');

		// Process command
		const result = processCommand(command);
		
		if (result.output === 'CLEAR') {
			lines = [];
			return;
		}

		// Add output
		if (Array.isArray(result.output)) {
			result.output.forEach(line => {
				addLine(line, 'output', result.type);
			});
		} else if (result.output) {
			addLine(result.output, 'output', result.type);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			executeCommand(currentInput);
			currentInput = '';
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
				currentInput = commandHistory[historyIndex] || '';
			}
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (historyIndex > 0) {
				historyIndex--;
				currentInput = commandHistory[historyIndex] || '';
			} else {
				historyIndex = -1;
				currentInput = '';
			}
		}
	}

	function startVoiceRecognition() {
		if (!voiceRecognition || !voiceRecognition.supported) {
			voiceError = 'Voice recognition is not supported in this browser';
			showVoiceStatus = true;
			setTimeout(() => showVoiceStatus = false, 3000);
			return;
		}

		if (isRecording) {
			voiceRecognition?.stop();
			return;
		}

		currentTranscript = '';
		transcriptConfidence = 0;
		voiceError = '';
		showVoiceStatus = true;

		voiceRecognition?.start(
			(result: VoiceRecognitionResult) => {
				currentTranscript = result.transcript;
				transcriptConfidence = result.confidence;
				
				if (result.isFinal) {
					currentInput = result.transcript;
					executeCommand(result.transcript);
					showVoiceStatus = false;
				}
			},
			(error: string) => {
				voiceError = error;
				isRecording = false;
				setTimeout(() => showVoiceStatus = false, 3000);
			},
			() => {
				isRecording = false;
				if (!voiceError) {
					setTimeout(() => showVoiceStatus = false, 1000);
				}
			}
		);

		isRecording = true;
	}

	onMount(() => {
		// Welcome message
		addLine('Voice Terminal Hybrid v1.0.0', 'system', 'success');
		addLine('Type "help" for available commands or click the microphone to use voice input.', 'system', 'info');
		addLine('', 'system');
		
		// Focus input
		inputElement?.focus();
	});

	$: isRecording = voiceRecognition?.listening || false;
</script>

<div class="terminal">
	<div class="terminal-header">
		<div class="terminal-title">🎤 Voice Terminal Hybrid</div>
		<div class="terminal-status">
			{#if voiceRecognition?.supported}
				<span class="voice-supported">Voice: Ready</span>
			{:else}
				<span class="voice-unsupported">Voice: Unsupported</span>
			{/if}
		</div>
	</div>

	{#if showVoiceStatus}
		<div class="voice-status" transition:fade={{ duration: 300 }}>
			{#if voiceError}
				<div class="voice-error">❌ {voiceError}</div>
			{:else if isRecording}
				<div class="voice-listening">🎤 Listening...</div>
				{#if currentTranscript}
					<div class="voice-transcript">"{currentTranscript}"</div>
					<div class="confidence-meter">
						<span>Confidence:</span>
						<div class="confidence-bar">
							<div 
								class="confidence-fill" 
								style="width: {transcriptConfidence * 100}%"
							></div>
						</div>
						<span>{Math.round(transcriptConfidence * 100)}%</span>
					</div>
				{/if}
			{:else}
				<div class="voice-processing">Processing...</div>
			{/if}
		</div>
	{/if}

	<div class="terminal-output" bind:this={outputElement}>
		{#each lines as line (line.id)}
			<div 
				class="output-line" 
				transition:fly={{ y: 20, duration: 300 }}
			>
				{#if line.type === 'command'}
					<span class="output-prompt">></span>
				{:else if line.type === 'output' && line.outputType}
					<span class="output-prompt">•</span>
				{/if}
				<span 
					class="output-content {line.outputType ? `output-${line.outputType}` : ''}"
					class:typewriter={line.isTyping}
				>
					{line.content}
				</span>
			</div>
		{/each}
	</div>

	<div class="terminal-input">
		<span class="input-prompt">$</span>
		<input 
			bind:this={inputElement}
			bind:value={currentInput}
			on:keydown={handleKeydown}
			class="input-field" 
			type="text" 
			placeholder="Enter command or use voice input..."
			autocomplete="off"
			spellcheck="false"
		/>
		<button 
			class="voice-button" 
			class:recording={isRecording}
			on:click={startVoiceRecognition}
			title={isRecording ? 'Stop recording' : 'Start voice input'}
		>
			{#if isRecording}
				🔴
			{:else}
				🎤
			{/if}
		</button>
	</div>
</div>

<style>
	.terminal-status {
		font-size: 0.9rem;
	}
	
	.voice-supported {
		color: #00ff00;
	}
	
	.voice-unsupported {
		color: #ff6b6b;
	}
	
	.voice-error {
		color: #ff6b6b;
	}
	
	.voice-listening {
		color: #00ff00;
		font-weight: bold;
	}
	
	.voice-transcript {
		color: #74c0fc;
		font-style: italic;
		margin: 0.5rem 0;
	}
	
	.voice-processing {
		color: #ffd43b;
	}
</style>