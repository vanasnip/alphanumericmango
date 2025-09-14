<script lang="ts">
	import FlexibleTerminal from '$lib/components/FlexibleTerminal.svelte';
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
	}
</style>