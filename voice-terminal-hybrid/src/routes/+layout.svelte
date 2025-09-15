<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { themeStore } from '$lib/stores/theme.js';
	
	// Initialize theme system on mount
	onMount(() => {
		// Theme store will auto-load and start watching
		// This ensures theme is applied before components render
	});
</script>

<slot />