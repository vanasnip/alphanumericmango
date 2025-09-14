<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import type { TerminalLine, VoiceRecognitionResult, ConversationMessage } from '../types.js';
	import type { VoiceRecognition } from '../voiceRecognition.js';
	import type { TextToSpeech } from '../textToSpeech.js';
	import { processCommand } from '../mockCommands.js';
	import { createVoiceRecognition } from '../voiceRecognition.js';
	import { createTextToSpeech } from '../textToSpeech.js';
	import { aiHandler } from '../aiConversation.js';

	let lines: TerminalLine[] = [];
	let currentInput = '';
	let commandHistory: string[] = [];
	let historyIndex = -1;
	let inputElement: HTMLInputElement;
	let outputElement: HTMLDivElement;
	let conversationElement: HTMLDivElement;
	
	// Voice recognition and TTS
	let voiceRecognition: VoiceRecognition | null = null;
	let textToSpeech: TextToSpeech | null = null;
	let isRecording = false;
	let currentTranscript = '';
	let transcriptConfidence = 0;
	let voiceError = '';
	let showVoiceStatus = false;
	
	// AI conversation state
	let conversationMode = true; // Start in conversation mode
	let conversation: ConversationMessage[] = [];
	let pendingCommand = '';
	let isAISpeaking = false;
	
	// Initialize on mount
	onMount(() => {
		voiceRecognition = createVoiceRecognition();
		textToSpeech = createTextToSpeech();
		
		// Welcome message
		addLine('🤖 AI Terminal Assistant Ready', 'system', 'info');
		addLine('Speak naturally to interact. Say "execute" to run commands.', 'system', 'info');
		addLine('Type "help" or click the mic to start', 'system', 'info');
		
		// Auto-focus input
		if (inputElement) inputElement.focus();
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
		if (conversationElement) {
			conversationElement.scrollTop = conversationElement.scrollHeight;
		}
	}

	function executeCommand(command: string) {
		if (!command.trim()) return;
		
		// Add to history
		commandHistory = [...commandHistory, command];
		historyIndex = commandHistory.length;
		
		// Display command
		addLine(`$ ${command}`, 'command');
		
		// Process command
		const result = processCommand(command);
		
		// Display output with appropriate styling
		result.output.forEach(line => {
			setTimeout(() => {
				addLine(line, 'output', result.type);
			}, 100);
		});
		
		// Clear input
		currentInput = '';
	}

	function handleVoiceInput(transcript: string) {
		// Process through AI conversation handler
		const response = aiHandler.processUserInput(transcript);
		
		// Update conversation history
		conversation = aiHandler.getConversation();
		scrollToBottom();
		
		if (response.type === 'execute') {
			// Execute the command
			if (response.command) {
				addLine(`🎤 Voice command: "${transcript}"`, 'system', 'info');
				executeCommand(response.command);
			}
			// Speak confirmation
			textToSpeech?.speak("Command executed");
		} else {
			// Conversation mode - speak the AI response
			textToSpeech?.speak(response.response, {
				onEnd: () => {
					isAISpeaking = false;
				}
			});
			isAISpeaking = true;
			
			// Store pending command if suggested
			if (response.command) {
				pendingCommand = response.command;
			}
		}
	}

	function startVoiceRecording() {
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

		// Stop any ongoing speech
		textToSpeech?.stop();
		isAISpeaking = false;

		currentTranscript = '';
		transcriptConfidence = 0;
		voiceError = '';
		showVoiceStatus = true;

		voiceRecognition?.start(
			(result: VoiceRecognitionResult) => {
				currentTranscript = result.transcript;
				transcriptConfidence = result.confidence;
				
				if (result.isFinal) {
					handleVoiceInput(result.transcript);
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

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			executeCommand(currentInput);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (historyIndex > 0) {
				historyIndex--;
				currentInput = commandHistory[historyIndex];
			}
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
				currentInput = commandHistory[historyIndex];
			} else {
				historyIndex = commandHistory.length;
				currentInput = '';
			}
		}
	}

	function toggleMode() {
		conversationMode = !conversationMode;
		addLine(
			conversationMode ? '🤖 Switched to Conversation Mode' : '⌨️ Switched to Direct Mode',
			'system',
			'info'
		);
	}

	function clearConversation() {
		aiHandler.clearConversation();
		conversation = [];
		pendingCommand = '';
		addLine('🔄 Conversation cleared', 'system', 'info');
	}

	$: isRecording = voiceRecognition?.listening || false;
</script>

<div class="terminal-container">
	<!-- Header -->
	<div class="terminal-header">
		<div class="terminal-title">
			<span class="icon">🤖</span>
			AI Voice Terminal
		</div>
		<div class="terminal-controls">
			<button 
				class="mode-toggle" 
				class:active={conversationMode}
				on:click={toggleMode}
			>
				{conversationMode ? '💬 Conversation' : '⌨️ Direct'}
			</button>
			{#if voiceRecognition?.supported}
				<span class="voice-indicator" class:active={isRecording}>
					🎤 {isRecording ? 'Listening...' : 'Ready'}
				</span>
			{/if}
		</div>
	</div>

	<div class="terminal-body">
		<!-- Conversation Panel -->
		{#if conversationMode}
		<div class="conversation-panel" bind:this={conversationElement} transition:slide>
			<div class="conversation-header">
				<span>AI Conversation</span>
				<button class="clear-btn" on:click={clearConversation}>Clear</button>
			</div>
			<div class="conversation-messages">
				{#each conversation as msg (msg.id)}
					<div class="message {msg.role}" transition:fade>
						<div class="message-role">{msg.role === 'user' ? '👤 You' : '🤖 AI'}</div>
						<div class="message-content">{msg.content}</div>
					</div>
				{/each}
				{#if isAISpeaking}
					<div class="speaking-indicator">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				{/if}
			</div>
			{#if pendingCommand}
				<div class="pending-command" transition:fade>
					<span class="label">Ready to execute:</span>
					<code>{pendingCommand}</code>
					<span class="hint">Say "execute" to run</span>
				</div>
			{/if}
		</div>
		{/if}

		<!-- Terminal Output -->
		<div class="terminal-output" bind:this={outputElement}>
			{#each lines as line (line.id)}
				<div 
					class="terminal-line {line.type}" 
					class:typing={line.isTyping}
					transition:fly={{ y: 10, duration: 200 }}
				>
					{#if line.type === 'command'}
						<span class="prompt">$</span> {line.content.substring(2)}
					{:else if line.type === 'system'}
						<span class="system-marker">[SYSTEM]</span> {line.content}
					{:else}
						<span class="output-content {line.outputType}">{line.content}</span>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Input Area -->
		<div class="terminal-input-area">
			<div class="input-line">
				<span class="prompt">$</span>
				<input
					bind:this={inputElement}
					bind:value={currentInput}
					on:keydown={handleKeyDown}
					type="text"
					class="terminal-input"
					placeholder="Type command or click mic to speak..."
				/>
			</div>
		</div>
	</div>

	<!-- Voice Controls -->
	<div class="voice-controls">
		<button 
			class="voice-button" 
			class:recording={isRecording}
			class:speaking={isAISpeaking}
			on:click={startVoiceRecording}
			disabled={!voiceRecognition?.supported}
		>
			{#if isRecording}
				<span class="pulse"></span>
				🎤 Listening...
			{:else if isAISpeaking}
				🔊 Speaking...
			{:else}
				🎤 Click to Speak
			{/if}
		</button>

		{#if showVoiceStatus}
			<div class="voice-status" transition:fade>
				{#if voiceError}
					<div class="error">{voiceError}</div>
				{:else if currentTranscript}
					<div class="transcript">
						<span class="label">Heard:</span> "{currentTranscript}"
						<span class="confidence">({Math.round(transcriptConfidence * 100)}% confident)</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.terminal-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #0a0a0a;
		color: #00ff00;
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.terminal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #1a1a1a;
		border-bottom: 2px solid #00ff00;
	}

	.terminal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.2rem;
		font-weight: bold;
	}

	.terminal-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.mode-toggle {
		padding: 0.5rem 1rem;
		background: #1a1a1a;
		color: #00ff00;
		border: 1px solid #00ff00;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.3s;
	}

	.mode-toggle.active {
		background: #00ff00;
		color: #0a0a0a;
	}

	.voice-indicator {
		padding: 0.5rem;
		border-radius: 4px;
		background: #1a1a1a;
		border: 1px solid #333;
	}

	.voice-indicator.active {
		border-color: #ff0000;
		animation: pulse 1s infinite;
	}

	.terminal-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.conversation-panel {
		max-height: 40%;
		background: #0f0f0f;
		border-bottom: 1px solid #333;
		display: flex;
		flex-direction: column;
	}

	.conversation-header {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
	}

	.clear-btn {
		padding: 0.25rem 0.5rem;
		background: #333;
		color: #00ff00;
		border: none;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.conversation-messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.message {
		padding: 0.75rem;
		border-radius: 8px;
		background: #1a1a1a;
		border-left: 3px solid #333;
	}

	.message.user {
		border-left-color: #00aaff;
		margin-left: 2rem;
	}

	.message.assistant {
		border-left-color: #00ff00;
		margin-right: 2rem;
	}

	.message-role {
		font-size: 0.8rem;
		opacity: 0.7;
		margin-bottom: 0.25rem;
	}

	.message-content {
		line-height: 1.4;
	}

	.speaking-indicator {
		display: flex;
		gap: 0.3rem;
		padding: 0.5rem;
		justify-content: center;
	}

	.speaking-indicator .dot {
		width: 8px;
		height: 8px;
		background: #00ff00;
		border-radius: 50%;
		animation: speaking 1.4s infinite;
	}

	.speaking-indicator .dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.speaking-indicator .dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	.pending-command {
		padding: 0.75rem 1rem;
		background: #1a3a1a;
		border-top: 1px solid #00ff00;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.pending-command code {
		flex: 1;
		padding: 0.25rem 0.5rem;
		background: #0a0a0a;
		border-radius: 3px;
	}

	.pending-command .hint {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.terminal-output {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.terminal-line {
		margin-bottom: 0.5rem;
		word-wrap: break-word;
	}

	.terminal-line.command {
		color: #00aaff;
	}

	.terminal-line.system {
		color: #ffaa00;
		font-style: italic;
	}

	.terminal-line.typing {
		animation: typewriter 0.5s steps(30);
	}

	.output-content.success {
		color: #00ff00;
	}

	.output-content.error {
		color: #ff3333;
	}

	.output-content.info {
		color: #00aaff;
	}

	.output-content.warning {
		color: #ffaa00;
	}

	.terminal-input-area {
		padding: 1rem;
		background: #1a1a1a;
		border-top: 1px solid #333;
	}

	.input-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.prompt {
		color: #00ff00;
		font-weight: bold;
	}

	.terminal-input {
		flex: 1;
		background: transparent;
		border: none;
		color: #00ff00;
		font-family: inherit;
		font-size: inherit;
		outline: none;
	}

	.voice-controls {
		padding: 1rem;
		background: #0f0f0f;
		border-top: 1px solid #333;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.voice-button {
		padding: 1rem 2rem;
		font-size: 1.1rem;
		background: #1a1a1a;
		color: #00ff00;
		border: 2px solid #00ff00;
		border-radius: 50px;
		cursor: pointer;
		transition: all 0.3s;
		position: relative;
	}

	.voice-button:hover:not(:disabled) {
		background: #00ff00;
		color: #0a0a0a;
	}

	.voice-button.recording {
		border-color: #ff0000;
		color: #ff0000;
		animation: pulse 1s infinite;
	}

	.voice-button.speaking {
		border-color: #00aaff;
		color: #00aaff;
	}

	.voice-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pulse {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		border: 2px solid #ff0000;
		border-radius: 50px;
		animation: pulse-ring 1s infinite;
	}

	.voice-status {
		width: 100%;
		max-width: 500px;
		padding: 0.75rem;
		background: #1a1a1a;
		border-radius: 8px;
		border: 1px solid #333;
	}

	.voice-status .error {
		color: #ff3333;
	}

	.voice-status .transcript {
		color: #00ff00;
	}

	.voice-status .confidence {
		opacity: 0.7;
		font-size: 0.9rem;
		margin-left: 0.5rem;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	@keyframes pulse-ring {
		0% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -50%) scale(1.3);
			opacity: 0;
		}
	}

	@keyframes speaking {
		0%, 60%, 100% {
			transform: scale(1);
			opacity: 0.3;
		}
		30% {
			transform: scale(1.3);
			opacity: 1;
		}
	}

	@keyframes typewriter {
		from {
			width: 0;
		}
		to {
			width: 100%;
		}
	}

	/* Scrollbar styling */
	::-webkit-scrollbar {
		width: 8px;
	}

	::-webkit-scrollbar-track {
		background: #0a0a0a;
	}

	::-webkit-scrollbar-thumb {
		background: #333;
		border-radius: 4px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: #00ff00;
	}
</style>