<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { Card, Button, Badge, Input, Tabs, TabItem } from 'flowbite-svelte';
	import type { TerminalLine, VoiceRecognitionResult, ConversationMessage } from '../types.js';
	import type { VoiceRecognition } from '../voiceRecognition.js';
	import type { TextToSpeech } from '../textToSpeech.js';
	import { processCommand } from '../mockCommands.js';
	import { createVoiceRecognition } from '../voiceRecognition.js';
	import { createTextToSpeech } from '../textToSpeech.js';
	import { enhancedAIHandler } from '../aiConversationEnhanced.js';
	import { layoutStore } from '../stores/layoutStore.js';
	import { themeStore, currentColors, terminalTheme } from '../stores/theme.js';
	import { voiceNavigation } from '../voiceNavigation.js';
	import ThemedButton from './themed/ThemedButton.svelte';
	import VoiceIndicator from './themed/VoiceIndicator.svelte';
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
	
	// Voice state tracking
	let voiceState = 'idle'; // idle, listening, processing, speaking, error
	
	// Theme integration
	$: colors = $currentColors;
	$: terminal = $terminalTheme;
	
	// Initialize on mount
	onMount(() => {
		voiceRecognition = createVoiceRecognition();
		textToSpeech = createTextToSpeech();
		
		// Load theme settings
		themeStore.loadSettings();
		themeStore.startWatching();
		
		// Initialize voice navigation
		setupVoiceNavigation();
		
		// Welcome message with themed styling
		addLine('🤖 AI Terminal Assistant Ready', 'system', 'info');
		addLine('Speak naturally to interact. Say "execute" to run commands.', 'system', 'info');
		addLine('Use voice commands like "1", "2", "Project 1", or "Message 3" to navigate.', 'system', 'info');
		
		// Auto-focus input
		if (inputElement) inputElement.focus();
		
		return () => {
			themeStore.stopWatching();
		};
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
			voiceState = 'speaking';
			textToSpeech?.speak("Command executed", {
				onEnd: () => {
					isAISpeaking = false;
					voiceState = 'idle';
				}
			});
		} else if (response.type === 'ui-action') {
			// Handle UI action responses
			addLine(`🎨 UI Action: ${response.response}`, 'system', 'success');
			voiceState = 'speaking';
			textToSpeech?.speak(response.response, {
				onEnd: () => {
					isAISpeaking = false;
					voiceState = 'idle';
				}
			});
			isAISpeaking = true;
		} else {
			voiceState = 'speaking';
			textToSpeech?.speak(response.response, {
				onEnd: () => {
					isAISpeaking = false;
					voiceState = 'idle';
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
			voiceState = 'error';
			showVoiceStatus = true;
			setTimeout(() => {
				showVoiceStatus = false;
				voiceState = 'idle';
			}, 3000);
			return;
		}

		if (isRecording) {
			voiceRecognition?.stop();
			voiceState = 'idle';
			return;
		}

		textToSpeech?.stop();
		isAISpeaking = false;
		voiceState = 'listening';

		currentTranscript = '';
		transcriptConfidence = 0;
		voiceError = '';
		showVoiceStatus = true;

		voiceRecognition?.start(
			(result: VoiceRecognitionResult) => {
				currentTranscript = result.transcript;
				transcriptConfidence = result.confidence;
				voiceState = 'listening';
				
				if (result.isFinal) {
					voiceState = 'processing';
					handleVoiceInput(result.transcript);
					showVoiceStatus = false;
					voiceState = 'idle';
				}
			},
			(error: string) => {
				voiceError = error;
				isRecording = false;
				voiceState = 'error';
				setTimeout(() => {
					showVoiceStatus = false;
					voiceState = 'idle';
				}, 3000);
			},
			() => {
				isRecording = false;
				if (!voiceError) {
					voiceState = 'idle';
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

	// Initialize global handlers
	let numberedMessages = new Map();
	let handleGlobalKeyDown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key === '?') {
			event.preventDefault();
			showVoiceMenu = true;
		}
	};
</script>

<svelte:window on:keydown={handleGlobalKeyDown} />

<div class="themed-terminal {layoutClass}" class:dragging={isDragging} style="
	--terminal-bg: {colors.background};
	--terminal-surface: {colors.surface};
	--terminal-text: {colors.text};
	--terminal-primary: {colors.primary};
	--terminal-secondary: {colors.secondary};
	--terminal-success: {colors.success};
	--terminal-warning: {colors.warning};
	--terminal-error: {colors.error};
">
	<!-- Project Tabs -->
	<ProjectTabs />
	
	<!-- Layout Controls Header -->
	<Card class="layout-controls theme-surface" size="none">
		<div class="control-header">
			<div class="control-group">
				<ThemedButton 
					variant={$layoutStore.mode === 'vertical' ? 'primary' : 'secondary'}
					size="sm"
					on:click={() => layoutStore.setMode('vertical')}
					customClass="layout-control"
				>
					⬌
				</ThemedButton>
				<ThemedButton 
					variant={$layoutStore.mode === 'horizontal' ? 'primary' : 'secondary'}
					size="sm"
					on:click={() => layoutStore.setMode('horizontal')}
					customClass="layout-control"
				>
					⬍
				</ThemedButton>
				<ThemedButton 
					variant="accent"
					size="sm"
					on:click={() => layoutStore.swapPanels()}
					customClass="swap-control"
				>
					🔄
				</ThemedButton>
			</div>
			
			<div class="title-section">
				<h1 class="terminal-title">🤖 AI Voice Terminal</h1>
				<Badge color="blue" class="theme-badge">{$themeStore.preset} theme</Badge>
			</div>
			
			<div class="control-group">
				{#if voiceRecognition?.supported}
					<VoiceIndicator 
						state={voiceState}
						confidence={transcriptConfidence}
						size="sm"
						on:click={startVoiceRecording}
						customClass="header-voice-indicator"
					/>
				{/if}
				<ThemedButton 
					variant="info"
					size="sm"
					on:click={() => showVoiceMenu = true}
					title="Show voice commands (Ctrl+? or Cmd+?)"
				>
					❓
				</ThemedButton>
			</div>
		</div>
	</Card>

	<div class="layout-container" style="--split-ratio: {$layoutStore.splitRatio}">
		<!-- Terminal Panel -->
		<Card class="terminal-panel theme-surface" size="none">
			<div class="panel-header" slot="header">
				<div class="header-content">
					<h3 class="panel-title">Terminal</h3>
					<Badge color="green" size="sm">Active</Badge>
				</div>
				<ThemedButton 
					variant="warning"
					size="xs" 
					on:click={() => lines = []}
					title="Clear terminal"
					customClass="clear-control"
				>
					Clear
				</ThemedButton>
			</div>
			
			<div class="terminal-output themed-terminal" bind:this={outputElement}>
				{#each lines as line (line.id)}
					<div 
						class="terminal-line {line.type}" 
						class:typing={line.isTyping}
						transition:fly={{ y: 10, duration: 200 }}
					>
						{#if line.type === 'command'}
							<span class="prompt">$</span> 
							<span class="command-text">{line.content.substring(2)}</span>
						{:else if line.type === 'system'}
							<Badge color="purple" size="xs" class="system-badge">[SYS]</Badge>
							<span class="system-content">{line.content}</span>
						{:else}
							<span class="output-content {line.outputType}">{line.content}</span>
						{/if}
					</div>
				{/each}
			</div>
			
			<div class="terminal-input-area">
				<div class="input-wrapper">
					<span class="input-prompt">$</span>
					<Input
						bind:this={inputElement}
						bind:value={currentInput}
						on:keydown={handleKeyDown}
						type="text"
						class="terminal-input themed-input"
						placeholder="Type command..."
						size="md"
					/>
				</div>
			</div>
		</Card>

		<!-- Resize Handle -->
		<div 
			class="split-handle themed-handle"
			bind:this={splitHandle}
			on:mousedown={handleMouseDown}
		>
			<div class="handle-grip"></div>
		</div>

		<!-- Conversation Panel -->
		<Card class="conversation-panel theme-surface" size="none">
			<div class="panel-header" slot="header">
				<div class="header-content">
					<h3 class="panel-title">AI Assistant</h3>
					<Badge color={isAISpeaking ? 'yellow' : 'blue'} size="sm">
						{isAISpeaking ? 'Speaking' : 'Ready'}
					</Badge>
				</div>
				<ThemedButton 
					variant="warning"
					size="xs" 
					on:click={clearConversation}
					title="Clear conversation"
					customClass="clear-control"
				>
					Clear
				</ThemedButton>
			</div>
			
			<div class="conversation-messages themed-conversation" bind:this={conversationElement}>
				{#each conversation as msg, index (msg.id)}
					<div transition:fade>
						<Card class="message {msg.role} theme-message" size="sm">
							<div class="message-header">
								<div class="message-avatar">
									{msg.role === 'user' ? '👤' : '🤖'}
								</div>
								<Badge color={msg.role === 'user' ? 'green' : 'blue'} size="xs">
									{msg.role === 'user' ? 'You' : 'AI'}
								</Badge>
							</div>
							<div class="message-content themed-text">{msg.content}</div>
						</Card>
					</div>
				{/each}
				
				{#if isAISpeaking}
					<Card class="speaking-indicator theme-indicator" size="sm">
						<div class="dots-container">
							<span class="dot"></span>
							<span class="dot"></span>
							<span class="dot"></span>
						</div>
						<span class="speaking-text">AI is responding...</span>
					</Card>
				{/if}
			</div>
			
			{#if pendingCommand}
				<div transition:fade>
					<Card class="pending-command theme-pending">
					<div class="pending-content">
						<Badge color="orange" class="pending-label">Pending</Badge>
						<code class="pending-code">{pendingCommand}</code>
						<span class="pending-hint">Say "execute"</span>
					</div>
				</Card>
				</div>
			{/if}
			
			<div class="voice-control-area">
				<VoiceIndicator 
					state={voiceState}
					confidence={transcriptConfidence}
					size="lg"
					showConfidence={showVoiceStatus}
					on:click={startVoiceRecording}
					disabled={!voiceRecognition?.supported}
					customClass="main-voice-control"
				/>
				
				{#if showVoiceStatus && currentTranscript}
					<div transition:fade>
						<Card class="transcript-display theme-transcript">
							<div class="transcript-content">
								<Badge color="blue" size="xs">Transcript</Badge>
								<span class="transcript-text">"{currentTranscript}"</span>
								<Badge color="green" size="xs" class="confidence-badge">
									{Math.round(transcriptConfidence * 100)}%
							</Badge>
						</div>
					</Card>
					</div>
				{/if}
			</div>
		</Card>
	</div>
</div>

<!-- Voice Command Menu -->
<VoiceCommandMenu bind:isVisible={showVoiceMenu} />

<style>
	/* Theme-aware base styles */
	.themed-terminal {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--terminal-bg);
		color: var(--terminal-text);
		font-family: var(--font-family, 'Inter, system-ui');
		transition: all 0.3s ease;
	}

	/* Layout controls styling */
	:global(.layout-controls) {
		border: none !important;
		border-radius: 0 !important;
		background: var(--terminal-surface) !important;
		border-bottom: 2px solid var(--terminal-primary) !important;
		padding: 1rem !important;
	}

	.control-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		gap: 1rem;
	}

	.control-group {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.title-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.terminal-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--terminal-text);
		margin: 0;
		text-align: center;
	}

	:global(.theme-badge) {
		text-transform: capitalize;
	}

	:global(.layout-control),
	:global(.swap-control) {
		min-width: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
	}

	:global(.header-voice-indicator) {
		margin: 0;
	}

	/* Layout Container */
	.layout-container {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
		gap: 0;
	}

	/* Vertical Layout (side by side) */
	.layout-vertical .layout-container {
		flex-direction: row;
	}

	.layout-vertical.position-left :global(.terminal-panel) {
		order: 2;
		width: calc((1 - var(--split-ratio)) * 100%);
		flex-shrink: 0;
	}

	.layout-vertical.position-left :global(.conversation-panel) {
		order: 1;
		width: calc(var(--split-ratio) * 100%);
		flex-shrink: 0;
	}

	.layout-vertical.position-right :global(.terminal-panel) {
		order: 1;
		width: calc((1 - var(--split-ratio)) * 100%);
		flex-shrink: 0;
	}

	.layout-vertical.position-right :global(.conversation-panel) {
		order: 3;
		width: calc(var(--split-ratio) * 100%);
		flex-shrink: 0;
	}

	.layout-vertical .themed-handle {
		order: 2;
		width: 4px;
		cursor: col-resize;
		flex-shrink: 0;
	}

	/* Horizontal Layout (top/bottom) */
	.layout-horizontal .layout-container {
		flex-direction: column;
	}

	.layout-horizontal.position-top :global(.terminal-panel) {
		order: 2;
		height: calc((1 - var(--split-ratio)) * 100%);
		flex-shrink: 0;
	}

	.layout-horizontal.position-top :global(.conversation-panel) {
		order: 1;
		height: calc(var(--split-ratio) * 100%);
		flex-shrink: 0;
	}

	.layout-horizontal.position-bottom :global(.terminal-panel) {
		order: 1;
		height: calc((1 - var(--split-ratio)) * 100%);
		flex-shrink: 0;
	}

	.layout-horizontal.position-bottom :global(.conversation-panel) {
		order: 3;
		height: calc(var(--split-ratio) * 100%);
		flex-shrink: 0;
	}

	.layout-horizontal .themed-handle {
		order: 2;
		height: 4px;
		width: 100%;
		cursor: row-resize;
		flex-shrink: 0;
	}

	/* Split Handle */
	.themed-handle {
		background: var(--terminal-surface);
		position: relative;
		transition: background 0.2s;
		user-select: none;
		border: 1px solid color-mix(in srgb, var(--terminal-primary) 30%, transparent);
	}

	.themed-handle:hover {
		background: var(--terminal-primary);
		border-color: var(--terminal-primary);
	}

	.handle-grip {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.layout-vertical .handle-grip::after {
		content: '⋮';
		color: var(--terminal-text);
		font-size: 1.2rem;
		opacity: 0.6;
	}

	.layout-horizontal .handle-grip::after {
		content: '⋯';
		color: var(--terminal-text);
		font-size: 1.2rem;
		opacity: 0.6;
	}

	.themed-handle:hover .handle-grip::after {
		opacity: 1;
		color: var(--terminal-bg);
	}

	.dragging {
		user-select: none;
		cursor: grabbing !important;
	}

	/* Panel Styling */
	:global(.terminal-panel),
	:global(.conversation-panel) {
		display: flex !important;
		flex-direction: column !important;
		background: var(--terminal-surface) !important;
		border: 1px solid color-mix(in srgb, var(--terminal-primary) 20%, transparent) !important;
		border-radius: 0 !important;
		overflow: hidden !important;
		height: 100%;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--terminal-bg);
		border-bottom: 2px solid var(--terminal-primary);
		color: var(--terminal-text);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.panel-title {
		font-weight: 600;
		font-size: 1rem;
		color: var(--terminal-text);
		margin: 0;
	}

	:global(.clear-control) {
		min-width: 60px;
	}

	/* Terminal Output Styling */
	.terminal-output {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		background: var(--terminal-bg);
		font-family: var(--font-family-mono, 'JetBrains Mono, Fira Code, monospace');
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--terminal-text);
	}

	.terminal-line {
		margin-bottom: 0.75rem;
		word-wrap: break-word;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.25rem 0;
		transition: all 0.2s ease;
	}

	.terminal-line.typing {
		opacity: 0.8;
		animation: typing 1s ease-in-out infinite alternate;
	}

	.terminal-line.command {
		color: var(--terminal-primary);
		font-weight: 500;
	}

	.terminal-line.system {
		color: var(--terminal-secondary);
		font-style: italic;
		align-items: center;
	}

	.prompt {
		color: var(--terminal-success);
		font-weight: bold;
		flex-shrink: 0;
	}

	.command-text {
		color: var(--terminal-primary);
	}

	:global(.system-badge) {
		flex-shrink: 0;
	}

	.system-content {
		color: var(--terminal-secondary);
		font-style: italic;
	}

	.output-content {
		color: var(--terminal-text);
	}

	.output-content.success { color: var(--terminal-success); }
	.output-content.error { color: var(--terminal-error); }
	.output-content.info { color: var(--terminal-primary); }
	.output-content.warning { color: var(--terminal-warning); }

	/* Terminal Input Area */
	.terminal-input-area {
		padding: 1rem;
		background: var(--terminal-bg);
		border-top: 2px solid var(--terminal-primary);
	}

	.input-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.input-prompt {
		color: var(--terminal-success);
		font-weight: bold;
		font-family: var(--font-family-mono, monospace);
		flex-shrink: 0;
	}

	:global(.terminal-input) {
		flex: 1 !important;
		background: var(--terminal-surface) !important;
		border: 2px solid color-mix(in srgb, var(--terminal-primary) 30%, transparent) !important;
		color: var(--terminal-text) !important;
		font-family: var(--font-family-mono, monospace) !important;
		font-size: inherit !important;
		border-radius: 6px !important;
		transition: all 0.2s ease !important;
	}

	:global(.terminal-input:focus) {
		border-color: var(--terminal-primary) !important;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--terminal-primary) 20%, transparent) !important;
	}

	/* Conversation Messages */
	.conversation-messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--terminal-bg);
	}

	:global(.message) {
		border: 1px solid color-mix(in srgb, var(--terminal-primary) 20%, transparent) !important;
		transition: all 0.2s ease !important;
		position: relative !important;
	}

	:global(.message.user) {
		background: color-mix(in srgb, var(--terminal-success) 5%, var(--terminal-surface)) !important;
		border-color: color-mix(in srgb, var(--terminal-success) 30%, transparent) !important;
		margin-left: 2rem !important;
		margin-right: 0 !important;
	}

	:global(.message.assistant) {
		background: color-mix(in srgb, var(--terminal-primary) 5%, var(--terminal-surface)) !important;
		border-color: color-mix(in srgb, var(--terminal-primary) 30%, transparent) !important;
		margin-right: 2rem !important;
		margin-left: 0 !important;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.message-avatar {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.message-content {
		line-height: 1.5;
		color: var(--terminal-text);
		flex: 1;
	}

	/* Speaking Indicator */
	:global(.speaking-indicator) {
		background: color-mix(in srgb, var(--terminal-warning) 10%, var(--terminal-surface)) !important;
		border-color: var(--terminal-warning) !important;
		display: flex !important;
		flex-direction: column !important;
		align-items: center !important;
		gap: 0.5rem !important;
	}

	.dots-container {
		display: flex;
		gap: 0.4rem;
		justify-content: center;
	}

	.dot {
		width: 10px;
		height: 10px;
		background: var(--terminal-warning);
		border-radius: 50%;
		animation: speaking 1.4s infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }

	.speaking-text {
		color: var(--terminal-warning);
		font-weight: 500;
		font-size: 0.9rem;
	}

	/* Pending Command */
	:global(.pending-command) {
		background: color-mix(in srgb, var(--terminal-warning) 10%, var(--terminal-surface)) !important;
		border: 2px solid var(--terminal-warning) !important;
		margin: 0.5rem !important;
	}

	.pending-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
	}

	:global(.pending-label) {
		flex-shrink: 0;
	}

	.pending-code {
		padding: 0.5rem;
		background: var(--terminal-bg);
		border-radius: 4px;
		flex: 1;
		color: var(--terminal-text);
		font-family: var(--font-family-mono, monospace);
		font-size: 0.9rem;
	}

	.pending-hint {
		font-size: 0.8rem;
		color: var(--terminal-warning);
		font-weight: 500;
		flex-shrink: 0;
	}

	/* Voice Control Area */
	.voice-control-area {
		padding: 1rem;
		background: var(--terminal-bg);
		border-top: 2px solid var(--terminal-primary);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	:global(.main-voice-control) {
		margin: 0;
	}

	/* Transcript Display */
	:global(.transcript-display) {
		background: color-mix(in srgb, var(--terminal-primary) 10%, var(--terminal-surface)) !important;
		border: 2px solid var(--terminal-primary) !important;
		width: 100% !important;
	}

	.transcript-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.transcript-text {
		flex: 1;
		color: var(--terminal-text);
		font-style: italic;
		min-width: 0;
		word-break: break-word;
	}

	:global(.confidence-badge) {
		flex-shrink: 0;
	}

	/* Animations */
	@keyframes typing {
		0% { opacity: 0.8; }
		100% { opacity: 1; }
	}

	@keyframes speaking {
		0%, 60%, 100% {
			transform: scale(1);
			opacity: 0.4;
		}
		30% {
			transform: scale(1.4);
			opacity: 1;
		}
	}

	/* Theme Transitions */
	:global(.theme-transition) {
		transition: all 0.3s ease;
	}

	:global(.theme-surface) {
		background: var(--terminal-surface) !important;
		color: var(--terminal-text) !important;
	}

	:global(.themed-text) {
		color: var(--terminal-text) !important;
	}

	:global(.themed-input) {
		background: var(--terminal-bg) !important;
		border-color: var(--terminal-primary) !important;
		color: var(--terminal-text) !important;
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.themed-terminal {
			--terminal-bg: #000000;
			--terminal-surface: #1a1a1a;
			--terminal-text: #ffffff;
		}
		
		:global(.message) {
			border-width: 2px !important;
		}
	}

	/* Custom Scrollbar */
	.terminal-output::-webkit-scrollbar,
	.conversation-messages::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.terminal-output::-webkit-scrollbar-track,
	.conversation-messages::-webkit-scrollbar-track {
		background: var(--terminal-bg);
		border-radius: 4px;
	}

	.terminal-output::-webkit-scrollbar-thumb,
	.conversation-messages::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--terminal-primary) 40%, transparent);
		border-radius: 4px;
		border: 1px solid var(--terminal-bg);
	}

	.terminal-output::-webkit-scrollbar-thumb:hover,
	.conversation-messages::-webkit-scrollbar-thumb:hover {
		background: var(--terminal-primary);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.layout-container {
			--split-ratio: 0.5 !important;
		}
		
		.control-header {
			flex-direction: column;
			gap: 0.75rem;
			align-items: center;
		}
		
		.title-section {
			order: -1;
		}
		
		:global(.message.user),
		:global(.message.assistant) {
			margin-left: 0 !important;
			margin-right: 0 !important;
		}
		
		.terminal-output,
		.conversation-messages {
			padding: 0.75rem;
		}
		
		.terminal-input-area,
		.voice-control-area {
			padding: 0.75rem;
		}
	}

	@media (max-width: 480px) {
		.terminal-title {
			font-size: 1rem;
		}
		
		.control-group {
			gap: 0.25rem;
		}
		
		.terminal-line {
			flex-direction: column;
			gap: 0.25rem;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		* {
			animation: none !important;
			transition: none !important;
		}
	}
</style>