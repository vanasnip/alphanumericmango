<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import type { TerminalLine, VoiceRecognitionResult, ConversationMessage } from '../types.js';
	import type { VoiceRecognition } from '../voiceRecognition.js';
	import type { TextToSpeech } from '../textToSpeech.js';
	import { processCommand } from '../mockCommands.js';
	import { createVoiceRecognition } from '../voiceRecognition.js';
	import { createTextToSpeech } from '../textToSpeech.js';
	import { enhancedAIHandler } from '../aiConversationEnhanced.js';
	import { layoutStore } from '../stores/layoutStore.js';
	import VoiceCommandMenu from './VoiceCommandMenu.svelte';
	import ProjectTabs from './ProjectTabs.svelte';

	let lines: TerminalLine[] = [];
	let currentInput = '';
	let commandHistory: string[] = [];
	let historyIndex = -1;
	let inputElement: HTMLInputElement;
	let outputElement: HTMLDivElement;
	let conversationElement: HTMLDivElement;
	let splitHandle: HTMLDivElement;
	
	// Voice recognition and TTS
	let voiceRecognition: VoiceRecognition | null = null;
	let textToSpeech: TextToSpeech | null = null;
	let isRecording = false;
	let currentTranscript = '';
	let transcriptConfidence = 0;
	let voiceError = '';
	let showVoiceStatus = false;
	
	// AI conversation state
	let conversationMode = true;
	let conversation: ConversationMessage[] = [];
	let pendingCommand = '';
	let isAISpeaking = false;
	
	// Layout state
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let initialSplitRatio = 0;
	
	// Voice menu state
	let showVoiceMenu = false;
	
	// Initialize on mount
	onMount(() => {
		voiceRecognition = createVoiceRecognition();
		textToSpeech = createTextToSpeech();
		
		// Initialize voice navigation
		setupVoiceNavigation();
		
		// Welcome message
		addLine('🤖 AI Terminal Assistant Ready', 'system', 'info');
		addLine('Speak naturally to interact. Say "execute" to run commands.', 'system', 'info');
		addLine('Use voice commands like "1", "2", "Project 1", or "Message 3" to navigate.', 'system', 'info');
		
		// Auto-focus input
		if (inputElement) inputElement.focus();
	});
	
	function setupVoiceNavigation() {
		// Register layout controls
		voiceNavigation.registerItem('vertical-layout', 'menu', ['vertical split', 'vertical'], () => {
			layoutStore.setMode('vertical');
		});
		
		voiceNavigation.registerItem('horizontal-layout', 'menu', ['horizontal split', 'horizontal'], () => {
			layoutStore.setMode('horizontal');
		});
		
		voiceNavigation.registerItem('swap-panels', 'menu', ['swap panels', 'swap'], () => {
			layoutStore.swapPanels();
		});
		
		voiceNavigation.registerItem('clear-terminal', 'command', ['clear terminal'], () => {
			lines = [];
		});
		
		voiceNavigation.registerItem('clear-conversation', 'command', ['clear conversation'], () => {
			clearConversation();
		});
	}

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
		
		commandHistory = [...commandHistory, command];
		historyIndex = commandHistory.length;
		
		addLine(`$ ${command}`, 'command');
		
		const result = processCommand(command);
		
		result.output.forEach(line => {
			setTimeout(() => {
				addLine(line, 'output', result.type);
			}, 100);
		});
		
		currentInput = '';
	}

	function handleVoiceInput(transcript: string) {
		// First try voice navigation commands
		if (voiceNavigation.processVoiceCommand(transcript)) {
			return; // Navigation command handled
		}
		
		// Register user message with number
		const userNumber = voiceNavigation.getNextMessageNumber(true);
		
		const response = enhancedAIHandler.processUserInput(transcript);
		conversation = enhancedAIHandler.getConversation();
		
		// Register assistant message with number
		const assistantNumber = voiceNavigation.getNextMessageNumber(false);
		
		scrollToBottom();
		
		if (response.type === 'execute') {
			if (response.command) {
				addLine(`🎤 Voice command: "${transcript}"`, 'system', 'info');
				executeCommand(response.command);
			}
			textToSpeech?.speak("Command executed");
		} else if (response.type === 'ui-action') {
			// Handle UI action responses
			addLine(`🎨 UI Action: ${response.response}`, 'system', 'success');
			textToSpeech?.speak(response.response, {
				onEnd: () => {
					isAISpeaking = false;
				}
			});
			isAISpeaking = true;
		} else {
			textToSpeech?.speak(response.response, {
				onEnd: () => {
					isAISpeaking = false;
				}
			});
			isAISpeaking = true;
			
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

	function clearConversation() {
		enhancedAIHandler.clearConversation();
		conversation = [];
		pendingCommand = '';
		voiceNavigation.resetMessageCounter();
		numberedMessages.clear();
		addLine('🔄 Conversation cleared', 'system', 'info');
	}

	// Split resizing handlers
	function handleMouseDown(e: MouseEvent) {
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		initialSplitRatio = $layoutStore.splitRatio;
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		e.preventDefault();
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		
		const container = document.querySelector('.layout-container') as HTMLElement;
		if (!container) return;
		
		if ($layoutStore.mode === 'vertical') {
			const deltaX = e.clientX - dragStartX;
			const containerWidth = container.offsetWidth;
			const deltaRatio = deltaX / containerWidth;
			const newRatio = $layoutStore.conversationPosition === 'left' 
				? initialSplitRatio + deltaRatio
				: initialSplitRatio - deltaRatio;
			layoutStore.setSplitRatio(newRatio);
		} else {
			const deltaY = e.clientY - dragStartY;
			const containerHeight = container.offsetHeight;
			const deltaRatio = deltaY / containerHeight;
			const newRatio = $layoutStore.conversationPosition === 'top'
				? initialSplitRatio + deltaRatio
				: initialSplitRatio - deltaRatio;
			layoutStore.setSplitRatio(newRatio);
		}
	}

	function handleMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}

	$: isRecording = voiceRecognition?.listening || false;
	$: layoutClass = `layout-${$layoutStore.mode} position-${$layoutStore.conversationPosition}`;
</script>

<svelte:window on:keydown={handleGlobalKeyDown} />

<div class="flexible-terminal {layoutClass}" class:dragging={isDragging}>
	<!-- Project Tabs -->
	<ProjectTabs />
	
	<!-- Layout Controls -->
	<div class="layout-controls">
		<div class="control-group">
			<button 
				class="layout-btn"
				class:active={$layoutStore.mode === 'vertical'}
				on:click={() => layoutStore.setMode('vertical')}
				title="Vertical split"
			>
				⬌
			</button>
			<button 
				class="layout-btn"
				class:active={$layoutStore.mode === 'horizontal'}
				on:click={() => layoutStore.setMode('horizontal')}
				title="Horizontal split"
			>
				⬍
			</button>
			<button 
				class="layout-btn swap"
				on:click={() => layoutStore.swapPanels()}
				title="Swap panels"
			>
				🔄
			</button>
		</div>
		<div class="title">🤖 AI Voice Terminal</div>
		<div class="control-group">
			{#if voiceRecognition?.supported}
				<span class="voice-indicator" class:active={isRecording}>
					🎤 {isRecording ? 'Listening' : 'Ready'}
				</span>
			{/if}
			<button 
				class="voice-menu-btn"
				on:click={() => showVoiceMenu = true}
				title="Show voice commands (Ctrl+? or Cmd+?)"
			>
				❓
			</button>
		</div>
	</div>

	<div class="layout-container" style="--split-ratio: {$layoutStore.splitRatio}">
		<!-- Terminal Panel -->
		<div class="terminal-panel">
			<div class="panel-header">
				<span class="panel-title">Terminal</span>
				<button 
					class="clear-btn" 
					on:click={() => lines = []}
					title="Clear terminal"
				>
					Clear
				</button>
			</div>
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
							<span class="system-marker">[SYS]</span> {line.content}
						{:else}
							<span class="output-content {line.outputType}">{line.content}</span>
						{/if}
					</div>
				{/each}
			</div>
			<div class="terminal-input-area">
				<span class="prompt">$</span>
				<input
					bind:this={inputElement}
					bind:value={currentInput}
					on:keydown={handleKeyDown}
					type="text"
					class="terminal-input"
					placeholder="Type command..."
				/>
			</div>
		</div>

		<!-- Resize Handle -->
		<div 
			class="split-handle"
			bind:this={splitHandle}
			on:mousedown={handleMouseDown}
		>
			<div class="handle-grip"></div>
		</div>

		<!-- Conversation Panel -->
		<div class="conversation-panel">
			<div class="panel-header">
				<span class="panel-title">AI Assistant</span>
				<button 
					class="clear-btn" 
					on:click={clearConversation}
					title="Clear conversation"
				>
					Clear
				</button>
			</div>
			<div class="conversation-messages" bind:this={conversationElement}>
				{#each conversation as msg, index (msg.id)}
					<div class="message {msg.role}" transition:fade>
						<div class="message-role">{msg.role === 'user' ? '👤' : '🤖'}</div>
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
					<code>{pendingCommand}</code>
					<span class="hint">Say "execute"</span>
				</div>
			{/if}
			<div class="voice-control-area">
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
				{#if showVoiceStatus && currentTranscript}
					<div class="transcript-display" transition:fade>
						"{currentTranscript}"
						<span class="confidence">({Math.round(transcriptConfidence * 100)}%)</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Voice Command Menu -->
<VoiceCommandMenu bind:isVisible={showVoiceMenu} />

<style>
	.flexible-terminal {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #0a0a0a;
		color: #00ff00;
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.layout-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #1a1a1a;
		border-bottom: 2px solid #00ff00;
	}

	.control-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.numbered-control {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.layout-btn {
		padding: 0.5rem;
		background: #0a0a0a;
		color: #00ff00;
		border: 1px solid #333;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1.2rem;
		transition: all 0.2s;
		min-width: 36px;
	}

	.layout-btn:hover {
		border-color: #00ff00;
	}

	.layout-btn.active {
		background: #00ff00;
		color: #0a0a0a;
		border-color: #00ff00;
	}

	.layout-btn.swap {
		font-size: 1rem;
	}

	.title {
		font-size: 1.1rem;
		font-weight: bold;
	}

	.voice-indicator {
		padding: 0.5rem;
		border-radius: 4px;
		background: #0a0a0a;
		border: 1px solid #333;
		font-size: 0.9rem;
	}

	.voice-indicator.active {
		border-color: #ff0000;
		color: #ff0000;
		animation: pulse 1s infinite;
	}

	.voice-menu-btn {
		padding: 0.5rem;
		background: #0a0a0a;
		color: #00ff00;
		border: 1px solid #333;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s;
		min-width: 36px;
	}

	.voice-menu-btn:hover {
		border-color: #00ff00;
		background: #1a2a1a;
	}

	/* Layout Container */
	.layout-container {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
	}

	/* Vertical Layout (side by side) */
	.layout-vertical .layout-container {
		flex-direction: row;
	}

	.layout-vertical.position-left .terminal-panel {
		order: 2;
		width: calc((1 - var(--split-ratio)) * 100%);
	}

	.layout-vertical.position-left .conversation-panel {
		order: 1;
		width: calc(var(--split-ratio) * 100%);
	}

	.layout-vertical.position-right .terminal-panel {
		order: 1;
		width: calc((1 - var(--split-ratio)) * 100%);
	}

	.layout-vertical.position-right .conversation-panel {
		order: 3;
		width: calc(var(--split-ratio) * 100%);
	}

	.layout-vertical .split-handle {
		order: 2;
		width: 4px;
		cursor: col-resize;
	}

	/* Horizontal Layout (top/bottom) */
	.layout-horizontal .layout-container {
		flex-direction: column;
	}

	.layout-horizontal.position-top .terminal-panel {
		order: 2;
		height: calc((1 - var(--split-ratio)) * 100%);
	}

	.layout-horizontal.position-top .conversation-panel {
		order: 1;
		height: calc(var(--split-ratio) * 100%);
	}

	.layout-horizontal.position-bottom .terminal-panel {
		order: 1;
		height: calc((1 - var(--split-ratio)) * 100%);
	}

	.layout-horizontal.position-bottom .conversation-panel {
		order: 3;
		height: calc(var(--split-ratio) * 100%);
	}

	.layout-horizontal .split-handle {
		order: 2;
		height: 4px;
		width: 100%;
		cursor: row-resize;
	}

	/* Split Handle */
	.split-handle {
		background: #1a1a1a;
		position: relative;
		transition: background 0.2s;
		user-select: none;
	}

	.split-handle:hover {
		background: #2a2a2a;
	}

	.handle-grip {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 30px;
		height: 30px;
	}

	.layout-vertical .handle-grip::after {
		content: '⋮';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #666;
		font-size: 1.2rem;
	}

	.layout-horizontal .handle-grip::after {
		content: '⋯';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #666;
		font-size: 1.2rem;
	}

	.dragging {
		user-select: none;
		cursor: grabbing !important;
	}

	/* Panels */
	.terminal-panel,
	.conversation-panel {
		display: flex;
		flex-direction: column;
		background: #0a0a0a;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
	}

	.panel-title {
		font-weight: bold;
		color: #00ff00;
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

	.clear-btn:hover {
		background: #444;
	}

	/* Terminal Panel */
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

	.output-content.success { color: #00ff00; }
	.output-content.error { color: #ff3333; }
	.output-content.info { color: #00aaff; }
	.output-content.warning { color: #ffaa00; }

	.terminal-input-area {
		padding: 0.75rem 1rem;
		background: #1a1a1a;
		border-top: 1px solid #333;
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

	/* Conversation Panel */
	.conversation-messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.message {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: 6px;
		background: #1a1a1a;
		position: relative;
	}

	.message-number {
		position: absolute;
		left: -32px;
		top: 50%;
		transform: translateY(-50%);
	}

	.message.user {
		background: #1a2a1a;
		margin-left: 3rem; /* Extra space for number badge */
	}

	.message.assistant {
		background: #1a1a2a;
		margin-right: 2rem;
		margin-left: 3rem; /* Extra space for number badge */
	}

	.message-role {
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.message-content {
		line-height: 1.4;
		flex: 1;
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

	.speaking-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
	.speaking-indicator .dot:nth-child(3) { animation-delay: 0.4s; }

	.pending-command {
		padding: 0.5rem 1rem;
		background: #1a3a1a;
		border-top: 1px solid #00ff00;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.pending-command code {
		padding: 0.25rem 0.5rem;
		background: #0a0a0a;
		border-radius: 3px;
		flex: 1;
	}

	.pending-command .hint {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.voice-control-area {
		padding: 1rem;
		background: #1a1a1a;
		border-top: 1px solid #333;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.voice-button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		background: #1a1a1a;
		color: #00ff00;
		border: 2px solid #00ff00;
		border-radius: 25px;
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
		border-radius: 25px;
		animation: pulse-ring 1s infinite;
	}

	.transcript-display {
		padding: 0.5rem;
		background: #1a1a1a;
		border-radius: 4px;
		border: 1px solid #333;
		font-size: 0.9rem;
		max-width: 100%;
		text-align: center;
	}

	.transcript-display .confidence {
		opacity: 0.7;
		font-size: 0.8rem;
		margin-left: 0.5rem;
	}

	/* Animations */
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
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

	/* Scrollbar */
	::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	::-webkit-scrollbar-track {
		background: #0a0a0a;
	}

	::-webkit-scrollbar-thumb {
		background: #333;
		border-radius: 3px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: #00ff00;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.layout-container {
			--split-ratio: 0.5 !important;
		}
		
		.message.user,
		.message.assistant {
			margin: 0;
		}
	}
</style>