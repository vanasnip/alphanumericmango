<script lang="ts">
	import { onMount } from 'svelte';
	import FlexibleTerminal from '$lib/components/FlexibleTerminal.svelte';
	import { themeStore } from '$lib/stores/theme.js';

	// Initialize theme on app start
	onMount(() => {
		// Apply Ocean theme by default
		themeStore.setPreset('ocean');
		themeStore.loadSettings();
		themeStore.startWatching();
		
		return () => {
			themeStore.stopWatching();
		};
	});
</script>

<svelte:head>
	<title>AI Voice Terminal</title>
	<meta name="description" content="A conversational AI-powered voice terminal interface" />
</svelte:head>

<FlexibleTerminal />

<style>
	:global(html, body) {
		height: 100%;
		overflow: hidden;
		margin: 0;
		padding: 0;
		background: var(--terminal-bg, #0F172A);
		color: var(--terminal-text, #F1F5F9);
		font-family: var(--font-family, 'Inter, system-ui');
		transition: background-color 0.3s ease, color 0.3s ease;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(#app) {
		height: 100%;
		width: 100%;
	}
</style>