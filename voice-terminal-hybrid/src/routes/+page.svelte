<script lang="ts">
	import ConversationalTerminal from '$lib/components/ConversationalTerminal.svelte';
</script>

<svelte:head>
	<title>AI Voice Terminal</title>
	<meta name="description" content="A conversational AI-powered voice terminal interface" />
</svelte:head>

<ConversationalTerminal />

<style>
	:global(html, body) {
		height: 100%;
		overflow: hidden;
	}
</style>