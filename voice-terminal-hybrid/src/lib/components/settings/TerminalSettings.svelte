<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		Card, 
		Label, 
		Range, 
		Toggle, 
		Select,
		Input,
		Textarea,
		Button,
		ButtonGroup,
		NumberInput
	} from 'flowbite-svelte';
	import { 
		CommandLineIcon,
		ClockIcon,
		DocumentTextIcon,
		TrashIcon
	} from 'flowbite-svelte-icons';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Terminal settings state
	let fontSize = 14;
	let fontFamily = 'JetBrains Mono, monospace';
	let lineHeight = 1.5;
	let maxLines = 1000;
	let enableTypewriter = true;
	let typewriterSpeed = 50;
	let showTimestamps = false;
	let enableHistory = true;
	let historySize = 50;
	let autoComplete = true;
	let caseSensitive = false;
	let confirmClear = true;
	let saveSession = true;
	let customPrompt = '$';
	let startupCommand = '';
	let welcomeMessage = 'Voice Terminal Hybrid v1.0.0\\nType "help" for available commands.';

	// Font options
	const fontOptions = [
		{ value: 'JetBrains Mono, monospace', name: 'JetBrains Mono' },
		{ value: 'Fira Code, monospace', name: 'Fira Code' },
		{ value: 'Source Code Pro, monospace', name: 'Source Code Pro' },
		{ value: 'Roboto Mono, monospace', name: 'Roboto Mono' },
		{ value: 'Ubuntu Mono, monospace', name: 'Ubuntu Mono' },
		{ value: 'Courier New, monospace', name: 'Courier New' },
		{ value: 'Monaco, monospace', name: 'Monaco' },
		{ value: 'Consolas, monospace', name: 'Consolas' }
	];

	// Prompt options
	const promptOptions = [
		{ value: '$', name: '$ (Default)' },
		{ value: '>', name: '> (Simple)' },
		{ value: '>>>', name: '>>> (Python-style)' },
		{ value: '➜', name: '➜ (Arrow)' },
		{ value: '❯', name: '❯ (Modern)' },
		{ value: '⚡', name: '⚡ (Lightning)' },
		{ value: 'custom', name: 'Custom...' }
	];

	let customPromptValue = '';
	let showCustomPrompt = false;

	onMount(async () => {
		await loadTerminalSettings();
	});

	async function loadTerminalSettings() {
		try {
			const stored = localStorage.getItem('voice-terminal-terminal-settings');
			if (stored) {
				const settings = JSON.parse(stored);
				fontSize = settings.fontSize ?? 14;
				fontFamily = settings.fontFamily ?? 'JetBrains Mono, monospace';
				lineHeight = settings.lineHeight ?? 1.5;
				maxLines = settings.maxLines ?? 1000;
				enableTypewriter = settings.enableTypewriter ?? true;
				typewriterSpeed = settings.typewriterSpeed ?? 50;
				showTimestamps = settings.showTimestamps ?? false;
				enableHistory = settings.enableHistory ?? true;
				historySize = settings.historySize ?? 50;
				autoComplete = settings.autoComplete ?? true;
				caseSensitive = settings.caseSensitive ?? false;
				confirmClear = settings.confirmClear ?? true;
				saveSession = settings.saveSession ?? true;
				customPrompt = settings.customPrompt ?? '$';
				customPromptValue = settings.customPromptValue ?? '';
				startupCommand = settings.startupCommand ?? '';
				welcomeMessage = settings.welcomeMessage ?? 'Voice Terminal Hybrid v1.0.0\\nType "help" for available commands.';
				
				showCustomPrompt = customPrompt === 'custom';
			}
		} catch (error) {
			console.warn('Failed to load terminal settings:', error);
		}
	}

	async function saveTerminalSettings() {
		try {
			const settings = {
				fontSize,
				fontFamily,
				lineHeight,
				maxLines,
				enableTypewriter,
				typewriterSpeed,
				showTimestamps,
				enableHistory,
				historySize,
				autoComplete,
				caseSensitive,
				confirmClear,
				saveSession,
				customPrompt,
				customPromptValue,
				startupCommand,
				welcomeMessage
			};
			
			localStorage.setItem('voice-terminal-terminal-settings', JSON.stringify(settings));
			dispatch('change', { terminalSettings: settings });
		} catch (error) {
			dispatch('error', { error: 'Failed to save terminal settings' });
		}
	}

	function handlePromptChange() {
		showCustomPrompt = customPrompt === 'custom';
		saveTerminalSettings();
	}

	function clearHistory() {
		if (confirmClear && !confirm('Are you sure you want to clear the command history?')) {
			return;
		}
		
		try {
			localStorage.removeItem('voice-terminal-command-history');
			dispatch('change', { action: 'clear-history' });
		} catch (error) {
			dispatch('error', { error: 'Failed to clear history' });
		}
	}

	function resetToDefaults() {
		fontSize = 14;
		fontFamily = 'JetBrains Mono, monospace';
		lineHeight = 1.5;
		maxLines = 1000;
		enableTypewriter = true;
		typewriterSpeed = 50;
		showTimestamps = false;
		enableHistory = true;
		historySize = 50;
		autoComplete = true;
		caseSensitive = false;
		confirmClear = true;
		saveSession = true;
		customPrompt = '$';
		customPromptValue = '';
		startupCommand = '';
		welcomeMessage = 'Voice Terminal Hybrid v1.0.0\\nType "help" for available commands.';
		showCustomPrompt = false;
		
		saveTerminalSettings();
	}

	// Reactive save
	$: {
		if (typeof window !== 'undefined') {
			saveTerminalSettings();
		}
	}
</script>

<div class="terminal-settings-container space-y-6">
	<!-- Appearance Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Appearance
		</h3>
		
		<div class="space-y-4">
			<!-- Font Family -->
			<div>
				<Label for="font-family" class="mb-2 block">Font Family</Label>
				<Select
					id="font-family"
					bind:value={fontFamily}
					class="w-full font-mono"
				>
					{#each fontOptions as font (font.value)}
						<option value={font.value} style="font-family: {font.value};">
							{font.name}
						</option>
					{/each}
				</Select>
			</div>

			<!-- Font Size -->
			<div>
				<Label for="font-size" class="mb-2 block">
					Font Size: {fontSize}px
				</Label>
				<Range
					id="font-size"
					min="10"
					max="24"
					step="1"
					bind:value={fontSize}
					class="w-full"
				/>
			</div>

			<!-- Line Height -->
			<div>
				<Label for="line-height" class="mb-2 block">
					Line Height: {lineHeight}
				</Label>
				<Range
					id="line-height"
					min="1.0"
					max="2.5"
					step="0.1"
					bind:value={lineHeight}
					class="w-full"
				/>
			</div>

			<!-- Custom Prompt -->
			<div>
				<Label for="prompt-style" class="mb-2 block">Prompt Style</Label>
				<Select
					id="prompt-style"
					bind:value={customPrompt}
					on:change={handlePromptChange}
					class="w-full"
				>
					{#each promptOptions as prompt (prompt.value)}
						<option value={prompt.value}>{prompt.name}</option>
					{/each}
				</Select>
				
				{#if showCustomPrompt}
					<Input
						bind:value={customPromptValue}
						placeholder="Enter custom prompt..."
						class="mt-2 font-mono"
					/>
				{/if}
			</div>
		</div>
	</Card>

	<!-- Behavior Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Behavior
		</h3>
		
		<div class="space-y-4">
			<!-- Max Lines -->
			<div>
				<Label for="max-lines" class="mb-2 block">Maximum Lines</Label>
				<NumberInput
					id="max-lines"
					bind:value={maxLines}
					min="100"
					max="10000"
					step="100"
					class="w-full"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Maximum number of lines to keep in terminal buffer
				</p>
			</div>

			<!-- Typewriter Effect -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Typewriter Effect</Label>
					<p class="text-xs text-gray-500 mt-1">Animate text output character by character</p>
				</div>
				<Toggle bind:checked={enableTypewriter} />
			</div>

			{#if enableTypewriter}
				<div>
					<Label for="typewriter-speed" class="mb-2 block">
						Typewriter Speed: {typewriterSpeed}ms per character
					</Label>
					<Range
						id="typewriter-speed"
						min="10"
						max="200"
						step="10"
						bind:value={typewriterSpeed}
						class="w-full"
					/>
				</div>
			{/if}

			<!-- Show Timestamps -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Show Timestamps</Label>
					<p class="text-xs text-gray-500 mt-1">Display timestamps for each command</p>
				</div>
				<Toggle bind:checked={showTimestamps} />
			</div>

			<!-- Auto Complete -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Auto Complete</Label>
					<p class="text-xs text-gray-500 mt-1">Enable command auto-completion</p>
				</div>
				<Toggle bind:checked={autoComplete} />
			</div>

			<!-- Case Sensitive -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Case Sensitive Commands</Label>
					<p class="text-xs text-gray-500 mt-1">Commands must match exact case</p>
				</div>
				<Toggle bind:checked={caseSensitive} />
			</div>

			<!-- Confirm Clear -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Confirm Clear</Label>
					<p class="text-xs text-gray-500 mt-1">Ask for confirmation before clearing terminal</p>
				</div>
				<Toggle bind:checked={confirmClear} />
			</div>

			<!-- Save Session -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Save Session</Label>
					<p class="text-xs text-gray-500 mt-1">Restore terminal session on page reload</p>
				</div>
				<Toggle bind:checked={saveSession} />
			</div>
		</div>
	</Card>

	<!-- History Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Command History
		</h3>
		
		<div class="space-y-4">
			<!-- Enable History -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Enable History</Label>
					<p class="text-xs text-gray-500 mt-1">Remember previously executed commands</p>
				</div>
				<Toggle bind:checked={enableHistory} />
			</div>

			{#if enableHistory}
				<!-- History Size -->
				<div>
					<Label for="history-size" class="mb-2 block">History Size</Label>
					<NumberInput
						id="history-size"
						bind:value={historySize}
						min="10"
						max="1000"
						step="10"
						disabled={!enableHistory}
						class="w-full"
					/>
					<p class="text-xs text-gray-500 mt-1">
						Number of commands to remember
					</p>
				</div>

				<!-- Clear History -->
				<div class="flex items-center justify-between">
					<div>
						<Label class="text-sm font-medium">Clear History</Label>
						<p class="text-xs text-gray-500 mt-1">Remove all saved command history</p>
					</div>
					<Button
						size="sm"
						color="red"
						on:click={clearHistory}
						class="flex items-center gap-2"
					>
						<TrashIcon class="w-4 h-4" />
						Clear
					</Button>
				</div>
			{/if}
		</div>
	</Card>

	<!-- Startup Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Startup
		</h3>
		
		<div class="space-y-4">
			<!-- Welcome Message -->
			<div>
				<Label for="welcome-message" class="mb-2 block">Welcome Message</Label>
				<Textarea
					id="welcome-message"
					bind:value={welcomeMessage}
					rows="3"
					placeholder="Enter welcome message..."
					class="w-full font-mono"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Use \\n for line breaks
				</p>
			</div>

			<!-- Startup Command -->
			<div>
				<Label for="startup-command" class="mb-2 block">Startup Command</Label>
				<Input
					id="startup-command"
					bind:value={startupCommand}
					placeholder="help"
					class="w-full font-mono"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Command to run automatically when terminal starts
				</p>
			</div>
		</div>
	</Card>

	<!-- Actions -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Actions
		</h3>
		
		<ButtonGroup class="w-full">
			<Button
				color="alternative"
				class="flex-1"
				on:click={resetToDefaults}
			>
				Reset to Defaults
			</Button>
		</ButtonGroup>
	</Card>
</div>

<style>
	.terminal-settings-container :global(.range-slider) {
		margin: 0.5rem 0;
	}
	
	.terminal-settings-container :global(.toggle) {
		flex-shrink: 0;
	}

	.terminal-settings-container :global(.number-input) {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
	}
</style>