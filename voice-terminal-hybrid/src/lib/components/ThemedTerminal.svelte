<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Button, Input, Badge, Card, Modal } from 'flowbite-svelte';
	import { MicrophoneIcon, PauseIcon, ExclamationTriangleIcon } from 'flowbite-svelte-icons';
	import type { TerminalLine, VoiceRecognitionResult } from '../types.js';
	import type { VoiceRecognition } from '../voiceRecognition.js';
	import { processCommand } from '../mockCommands.js';
	import { createVoiceRecognition } from '../voiceRecognition.js';
	import { themeStore, terminalTheme } from '../stores/theme.js';
	import VoiceIndicator from './themed/VoiceIndicator.svelte';

	// Component props
	export let variant: 'standard' | 'compact' | 'fullscreen' = 'standard';
	export let showHeader = true;
	export let headerTitle = 'Voice Terminal Hybrid';
	export let placeholder = 'Enter command or use voice input...';
	export let maxLines = 1000;
	export let enableVoice = true;
	export let autoFocus = true;
	export let customClass = '';

	// Terminal state
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
	let showVoiceModal = false;
	
	// Theme integration
	$: theme = $terminalTheme;
	$: dynamicStyles = `
		--terminal-bg: ${theme.background || 'var(--color-background)'};
		--terminal-text: ${theme.color || 'var(--color-text)'};
		--terminal-font: ${theme.fontFamily || 'var(--font-mono)'};
		--terminal-font-size: ${theme.fontSize || 'var(--font-size-sm)'};
		--terminal-line-height: ${theme.lineHeight || '1.5'};
		--terminal-padding: ${theme.padding || 'var(--spacing-4)'};
		--terminal-border: ${theme.border || '1px solid var(--color-border)'};
		--terminal-border-radius: ${theme.borderRadius || 'var(--border-radius-lg)'};
	`;

	// Size variants
	$: sizeClass = {
		standard: 'h-96',
		compact: 'h-48',
		fullscreen: 'h-screen'
	}[variant] || 'h-96';

	// Initialize voice recognition on mount
	onMount(() => {
		if (enableVoice) {
			voiceRecognition = createVoiceRecognition();
		}
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
		
		// Limit lines to prevent memory issues
		if (lines.length > maxLines) {
			lines = lines.slice(-maxLines);
		}
		
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

		// Add output with appropriate styling
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

	function handleVoiceClick() {
		if (!voiceRecognition || !voiceRecognition.supported) {
			voiceError = 'Voice recognition is not supported in this browser';
			showVoiceModal = true;
			return;
		}

		if (isRecording) {
			voiceRecognition?.stop();
			return;
		}

		startVoiceRecognition();
	}

	function startVoiceRecognition() {
		currentTranscript = '';
		transcriptConfidence = 0;
		voiceError = '';
		showVoiceModal = true;

		voiceRecognition?.start(
			(result: VoiceRecognitionResult) => {
				currentTranscript = result.transcript;
				transcriptConfidence = result.confidence;
				
				if (result.isFinal) {
					currentInput = result.transcript;
					executeCommand(result.transcript);
					showVoiceModal = false;
				}
			},
			(error: string) => {
				voiceError = error;
				isRecording = false;
				// Keep modal open to show error
			},
			() => {
				isRecording = false;
				if (!voiceError) {
					showVoiceModal = false;
				}
			}
		);

		isRecording = true;
	}

	function clearTerminal() {
		lines = [];
	}

	function exportHistory() {
		const history = lines.map(line => ({
			timestamp: line.timestamp.toISOString(),
			type: line.type,
			content: line.content,
			outputType: line.outputType
		}));
		
		const dataStr = JSON.stringify(history, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		
		const link = document.createElement('a');
		link.href = url;
		link.download = `terminal-history-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		
		addLine('Terminal history exported successfully', 'system', 'success');
	}

	onMount(() => {
		// Welcome message
		addLine('Voice Terminal Hybrid v1.0.0', 'system', 'success');
		addLine('Type "help" for available commands or click the microphone to use voice input.', 'system', 'info');
		addLine('', 'system');
		
		// Focus input
		if (autoFocus && inputElement) {
			inputElement.focus();
		}
	});

	$: isRecording = voiceRecognition?.listening || false;
	$: voiceState = isRecording ? 'listening' : 'idle';
</script>

<Card class="terminal-card {customClass}" style={dynamicStyles}>
	{#if showHeader}
		<div class="terminal-header flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center gap-3">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					{headerTitle}
				</h3>
				<Badge color="green" class="text-xs">
					{#if voiceRecognition?.supported}
						Voice: Ready
					{:else}
						Voice: Unsupported
					{/if}
				</Badge>
			</div>
			
			<div class="flex items-center gap-2">
				<Button
					size="xs"
					color="alternative"
					on:click={clearTerminal}
					class="!p-1"
				>
					Clear
				</Button>
				<Button
					size="xs"
					color="alternative"
					on:click={exportHistory}
					class="!p-1"
				>
					Export
				</Button>
			</div>
		</div>
	{/if}

	<div class="terminal-content flex flex-col {sizeClass}">
		<!-- Terminal Output -->
		<div 
			class="terminal-output flex-1 overflow-y-auto p-4 space-y-1 font-mono text-sm"
			bind:this={outputElement}
			style="
				background: var(--terminal-bg);
				color: var(--terminal-text);
				font-family: var(--terminal-font);
				font-size: var(--terminal-font-size);
				line-height: var(--terminal-line-height);
			"
		>
			{#each lines as line (line.id)}
				<div 
					class="output-line flex items-start gap-2" 
					transition:fly={{ y: 20, duration: 300 }}
				>
					{#if line.type === 'command'}
						<span class="output-prompt text-blue-400 select-none">$</span>
					{:else if line.type === 'output' && line.outputType}
						<span class="output-prompt select-none" class:text-green-400={line.outputType === 'success'} class:text-red-400={line.outputType === 'error'} class:text-yellow-400={line.outputType === 'warning'} class:text-blue-400={line.outputType === 'info'}>•</span>
					{/if}
					<span 
						class="output-content flex-1"
						class:text-green-400={line.outputType === 'success'}
						class:text-red-400={line.outputType === 'error'}
						class:text-yellow-400={line.outputType === 'warning'}
						class:text-blue-400={line.outputType === 'info'}
						class:typewriter={line.isTyping}
					>
						{line.content}
					</span>
				</div>
			{/each}
		</div>

		<!-- Terminal Input -->
		<div class="terminal-input flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
			<span class="text-blue-400 font-mono select-none">$</span>
			<Input
				bind:this={inputElement}
				bind:value={currentInput}
				on:keydown={handleKeydown}
				class="flex-1 !bg-transparent !border-none !focus:ring-0 font-mono"
				{placeholder}
				autocomplete="off"
				spellcheck="false"
				style="
					color: var(--terminal-text);
					font-family: var(--terminal-font);
					font-size: var(--terminal-font-size);
				"
			/>
			{#if enableVoice}
				<VoiceIndicator
					state={voiceState}
					size="sm"
					{confidence: transcriptConfidence}
					showConfidence={false}
					disabled={!voiceRecognition?.supported}
					on:click={handleVoiceClick}
					ariaLabel="Voice input control"
				/>
			{/if}
		</div>
	</div>
</Card>

<!-- Voice Recognition Modal -->
<Modal 
	bind:open={showVoiceModal} 
	size="sm" 
	autoclose={false}
	class="voice-modal"
>
	<div class="text-center p-4">
		{#if voiceError}
			<ExclamationTriangleIcon class="mx-auto mb-4 text-red-500 w-12 h-12" />
			<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
				Voice Recognition Error
			</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-4">
				{voiceError}
			</p>
			<Button 
				color="alternative" 
				on:click={() => showVoiceModal = false}
			>
				Close
			</Button>
		{:else if isRecording}
			<VoiceIndicator 
				state="listening" 
				size="xl"
				confidence={transcriptConfidence}
				showConfidence={true}
				class="mb-4"
			/>
			<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
				Listening...
			</h3>
			{#if currentTranscript}
				<div class="voice-transcript p-3 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
					<p class="text-blue-600 dark:text-blue-400 italic">
						"{currentTranscript}"
					</p>
				</div>
			{/if}
			<Button 
				color="alternative" 
				on:click={() => voiceRecognition?.stop()}
			>
				<PauseIcon class="w-4 h-4 mr-2" />
				Stop Recording
			</Button>
		{:else}
			<div class="processing-indicator mb-4">
				<div class="processing-dots flex justify-center gap-1">
					<div class="dot w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
					<div class="dot w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
					<div class="dot w-2 h-2 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
				Processing...
			</h3>
			<p class="text-gray-600 dark:text-gray-400">
				Converting speech to text
			</p>
		{/if}
	</div>
</Modal>

<style>
	:global(.terminal-card) {
		max-width: none;
		border: var(--terminal-border);
		border-radius: var(--terminal-border-radius);
		background: var(--terminal-bg);
	}

	.terminal-output::-webkit-scrollbar {
		width: 8px;
	}

	.terminal-output::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 4px;
	}

	.terminal-output::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.3);
		border-radius: 4px;
	}

	.terminal-output::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.5);
	}

	.typewriter {
		overflow: hidden;
		border-right: 2px solid currentColor;
		white-space: nowrap;
		animation: typing 1s steps(40, end), blink-caret 0.75s step-end infinite;
	}

	@keyframes typing {
		from { width: 0; }
		to { width: 100%; }
	}

	@keyframes blink-caret {
		from, to { border-color: transparent; }
		50% { border-color: currentColor; }
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.typewriter {
			animation: none;
			border-right: none;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.terminal-input {
			flex-wrap: wrap;
			gap: 8px;
		}
		
		.terminal-header {
			flex-direction: column;
			gap: 8px;
			align-items: flex-start;
		}
	}
</style>