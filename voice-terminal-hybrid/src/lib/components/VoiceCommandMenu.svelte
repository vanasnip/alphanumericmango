<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationItems } from '../voiceNavigation.js';
	import VoiceNumberBadge from './VoiceNumberBadge.svelte';

	export let isVisible = false;

	let groupedCommands = {
		project: [],
		menu: [],
		command: [],
		message: []
	};

	// Subscribe to navigation items updates
	$: {
		if ($navigationItems) {
			groupedCommands = $navigationItems.reduce((groups, item) => {
				if (!groups[item.type]) groups[item.type] = [];
				groups[item.type].push(item);
				return groups;
			}, { project: [], menu: [], command: [], message: [] });
		}
	}

	function executeCommand(item) {
		if (item.callback) {
			item.callback();
		}
		isVisible = false;
	}

	const categoryLabels = {
		project: '🗂️ Projects',
		menu: '⚙️ Layout & Menu',
		command: '🔧 Commands',
		message: '💬 Messages'
	};

	const categoryDescriptions = {
		project: 'Switch between different projects',
		menu: 'Control layout and interface elements', 
		command: 'Execute terminal and system commands',
		message: 'Navigate conversation messages'
	};
</script>

{#if isVisible}
	<div class="voice-menu-overlay" on:click={() => isVisible = false}>
		<div class="voice-menu" on:click|stopPropagation>
			<div class="menu-header">
				<h3>🎤 Voice Commands</h3>
				<button class="close-btn" on:click={() => isVisible = false}>✕</button>
			</div>
			
			<div class="menu-description">
				<p>Say any number below, or use the natural language commands.</p>
				<div class="quick-tips">
					<span class="tip">"1" → First item</span>
					<span class="tip">"Project 2" → Second project</span>
					<span class="tip">"Message 5" → Fifth message</span>
				</div>
			</div>

			<div class="menu-content">
				{#each Object.entries(categoryLabels) as [type, label]}
					{#if groupedCommands[type].length > 0}
						<div class="command-category">
							<div class="category-header">
								<h4>{label}</h4>
								<span class="category-desc">{categoryDescriptions[type]}</span>
							</div>
							<div class="command-list">
								{#each groupedCommands[type] as item (item.id)}
									<div 
										class="command-item"
										class:active={item.isActive}
										on:click={() => executeCommand(item)}
									>
										<VoiceNumberBadge 
											number={item.number}
											type={item.type}
											voiceCommand={item.voiceCommands[0]}
											isActive={item.isActive}
											size="medium"
										/>
										<div class="command-details">
											<div class="command-primary">
												{item.voiceCommands[0]}
											</div>
											{#if item.voiceCommands.length > 1}
												<div class="command-alternatives">
													{#each item.voiceCommands.slice(1, 3) as alt}
														<span class="alt-command">"{alt}"</span>
													{/each}
													{#if item.voiceCommands.length > 3}
														<span class="more-commands">+{item.voiceCommands.length - 3} more</span>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				{#if Object.values(groupedCommands).every(arr => arr.length === 0)}
					<div class="empty-state">
						<div class="empty-icon">🎤</div>
						<p>No voice commands available yet.</p>
						<p class="empty-hint">Interact with the interface to see numbered commands.</p>
					</div>
				{/if}
			</div>

			<div class="menu-footer">
				<div class="keyboard-shortcuts">
					<kbd>Esc</kbd> to close • <kbd>?</kbd> to show this menu
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.voice-menu-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.voice-menu {
		background: #1a1a1a;
		border: 2px solid #00ff00;
		border-radius: 12px;
		width: 90vw;
		max-width: 600px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
	}

	.menu-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #333;
		background: #2a2a2a;
		border-radius: 10px 10px 0 0;
	}

	.menu-header h3 {
		margin: 0;
		color: #00ff00;
		font-size: 1.2rem;
	}

	.close-btn {
		background: none;
		border: none;
		color: #00ff00;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.close-btn:hover {
		background: rgba(0, 255, 0, 0.1);
	}

	.menu-description {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #333;
		background: #0a0a0a;
	}

	.menu-description p {
		margin: 0 0 0.5rem 0;
		color: #ccc;
	}

	.quick-tips {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.tip {
		font-size: 0.8rem;
		color: #666;
		background: #2a2a2a;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-family: monospace;
	}

	.menu-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.5rem;
	}

	.command-category {
		margin-bottom: 1.5rem;
	}

	.command-category:last-child {
		margin-bottom: 0;
	}

	.category-header {
		margin-bottom: 0.75rem;
	}

	.category-header h4 {
		margin: 0 0 0.25rem 0;
		color: #00ff00;
		font-size: 1rem;
	}

	.category-desc {
		font-size: 0.8rem;
		color: #666;
		font-style: italic;
	}

	.command-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.command-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.command-item:hover {
		border-color: #00ff00;
		background: #1a2a1a;
	}

	.command-item.active {
		border-color: #00ff00;
		background: #1a3a1a;
	}

	.command-details {
		flex: 1;
		min-width: 0;
	}

	.command-primary {
		font-weight: bold;
		color: #00ff00;
		margin-bottom: 0.25rem;
	}

	.command-alternatives {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.alt-command {
		font-size: 0.8rem;
		color: #888;
		background: #2a2a2a;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		font-family: monospace;
	}

	.more-commands {
		font-size: 0.8rem;
		color: #666;
		font-style: italic;
	}

	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #666;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.3;
	}

	.empty-hint {
		font-size: 0.9rem;
		font-style: italic;
		margin-top: 0.5rem;
	}

	.menu-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #333;
		background: #2a2a2a;
		border-radius: 0 0 10px 10px;
	}

	.keyboard-shortcuts {
		text-align: center;
		font-size: 0.8rem;
		color: #666;
	}

	.keyboard-shortcuts kbd {
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 0.125rem 0.25rem;
		font-size: 0.7rem;
		font-family: monospace;
	}

	/* Scrollbar */
	.menu-content::-webkit-scrollbar {
		width: 6px;
	}

	.menu-content::-webkit-scrollbar-track {
		background: #0a0a0a;
	}

	.menu-content::-webkit-scrollbar-thumb {
		background: #333;
		border-radius: 3px;
	}

	.menu-content::-webkit-scrollbar-thumb:hover {
		background: #00ff00;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.voice-menu {
			width: 95vw;
			max-height: 90vh;
		}
		
		.menu-header,
		.menu-description,
		.menu-content,
		.menu-footer {
			padding-left: 1rem;
			padding-right: 1rem;
		}
		
		.quick-tips {
			gap: 0.5rem;
		}
		
		.command-item {
			padding: 0.5rem;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.voice-menu {
			border-width: 3px;
		}
		
		.command-item {
			border-width: 2px;
		}
	}
</style>