<script lang="ts">
	import { onMount } from 'svelte';
	import { voiceNavigation } from '../voiceNavigation.js';
	import VoiceNumberBadge from './VoiceNumberBadge.svelte';

	export let projects = [
		{ id: 'voice-terminal', name: 'Voice Terminal', active: true },
		{ id: 'electron-shell', name: 'Electron Shell', active: false },
		{ id: 'modules', name: 'Modules', active: false }
	];

	let hoveredProject: number | null = null;
	let projectNumbers = new Map();

	onMount(() => {
		// Register projects with voice navigation
		projects.forEach((project, index) => {
			const number = index + 100; // Start project numbers at 100 to avoid conflicts
			const voiceCommands = [
				`project ${index + 1}`,
				`switch to ${project.name.toLowerCase()}`,
				project.name.toLowerCase()
			];
			
			voiceNavigation.registerItem(
				`project-${project.id}`,
				'project',
				voiceCommands,
				() => switchToProject(project.id)
			);
			
			projectNumbers.set(project.id, number);
		});
	});

	function switchToProject(projectId: string) {
		projects = projects.map(p => ({
			...p,
			active: p.id === projectId
		}));
		
		// In a real implementation, this would switch the actual project context
		console.log(`Switched to project: ${projectId}`);
	}
</script>

<div class="project-tabs">
	<div class="tabs-header">
		<span class="tabs-title">Projects</span>
		<span class="voice-hint">Say "Project 1", "Project 2", etc.</span>
	</div>
	<div class="tabs-container">
		{#each projects as project, index (project.id)}
			{@const number = index + 1}
			<div 
				class="project-tab" 
				class:active={project.active}
				on:click={() => switchToProject(project.id)}
				on:mouseenter={() => hoveredProject = number}
				on:mouseleave={() => hoveredProject = null}
				title="Voice: Say 'Project {number}' or '{project.name}'"
			>
				<VoiceNumberBadge 
					{number}
					type="project"
					voiceCommand="Project {number}"
					isActive={project.active}
					isHovered={hoveredProject === number}
					size="small"
				/>
				<span class="tab-name">{project.name}</span>
				{#if project.active}
					<span class="active-indicator">●</span>
				{/if}
			</div>
		{/each}
		
		<!-- Add project button -->
		<div 
			class="add-project-tab"
			title="Voice: Say 'Add project' or 'New project'"
		>
			<VoiceNumberBadge 
				number={projects.length + 1}
				type="command"
				voiceCommand="Add project"
				isHovered={hoveredProject === projects.length + 1}
				size="small"
			/>
			<span class="add-icon">+</span>
		</div>
	</div>
</div>

<style>
	.project-tabs {
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		padding: 0.5rem 1rem;
	}

	.tabs-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.tabs-title {
		font-weight: bold;
		color: #00ff00;
		font-size: 0.9rem;
	}

	.voice-hint {
		font-size: 0.7rem;
		color: #666;
		font-style: italic;
	}

	.tabs-container {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: #00ff00 #1a1a1a;
	}

	.tabs-container::-webkit-scrollbar {
		height: 4px;
	}

	.tabs-container::-webkit-scrollbar-track {
		background: #1a1a1a;
	}

	.tabs-container::-webkit-scrollbar-thumb {
		background: #00ff00;
		border-radius: 2px;
	}

	.project-tab,
	.add-project-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 6px;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s;
		min-width: fit-content;
	}

	.project-tab:hover,
	.add-project-tab:hover {
		border-color: #00ff00;
		background: #1a2a1a;
	}

	.project-tab.active {
		background: #2a2a1a;
		border-color: #00ff00;
		color: #00ff00;
	}

	.tab-name {
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.active-indicator {
		color: #00ff00;
		font-size: 0.6rem;
		margin-left: 0.25rem;
	}

	.add-project-tab {
		border-style: dashed;
		opacity: 0.7;
	}

	.add-project-tab:hover {
		opacity: 1;
	}

	.add-icon {
		font-size: 1.2rem;
		font-weight: bold;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.voice-hint {
			display: none;
		}
		
		.tabs-container {
			gap: 0.25rem;
		}
		
		.project-tab,
		.add-project-tab {
			padding: 0.4rem 0.6rem;
		}
		
		.tab-name {
			font-size: 0.8rem;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.project-tab,
		.add-project-tab {
			border-width: 2px;
		}
	}
</style>