<script lang="ts">
	import { 
		Toast,
		Button
	} from 'flowbite-svelte';
	import { 
		CheckCircleIcon,
		ExclamationCircleIcon,
		ExclamationTriangleIcon,
		InformationCircleIcon,
		XMarkIcon
	} from 'flowbite-svelte-icons';
	import { themeStore, colors } from '$lib/stores/theme.js';
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	const dispatch = createEventDispatcher();

	// Props
	export let id: string = Math.random().toString(36).substr(2, 9);
	export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
	export let title: string = '';
	export let message: string = '';
	export let duration: number = 5000; // Auto-dismiss after 5 seconds (0 = no auto-dismiss)
	export let dismissible: boolean = true;
	export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' = 'top-right';
	export let showIcon: boolean = true;
	export let showProgress: boolean = true;
	export let customClass: string = '';
	export let actionText: string = '';
	export let actionCallback: (() => void) | null = null;

	// State
	let visible = true;
	let progressValue = 100;
	let progressInterval: number | null = null;
	let autoCloseTimeout: number | null = null;

	// Theme integration
	$: currentColors = $colors;
	$: dynamicStyles = `
		--toast-bg: ${currentColors.surface};
		--toast-border: ${getTypeColor()};
		--toast-text: ${currentColors.text};
		--toast-icon: ${getTypeColor()};
		--toast-progress: ${getTypeColor()};
	`;

	// Type-specific configurations
	$: typeConfig = {
		success: {
			icon: CheckCircleIcon,
			color: currentColors.success,
			bgColor: `color-mix(in srgb, ${currentColors.success} 10%, ${currentColors.surface})`,
			borderColor: currentColors.success
		},
		error: {
			icon: ExclamationCircleIcon,
			color: currentColors.error,
			bgColor: `color-mix(in srgb, ${currentColors.error} 10%, ${currentColors.surface})`,
			borderColor: currentColors.error
		},
		warning: {
			icon: ExclamationTriangleIcon,
			color: currentColors.warning,
			bgColor: `color-mix(in srgb, ${currentColors.warning} 10%, ${currentColors.surface})`,
			borderColor: currentColors.warning
		},
		info: {
			icon: InformationCircleIcon,
			color: currentColors.primary,
			bgColor: `color-mix(in srgb, ${currentColors.primary} 10%, ${currentColors.surface})`,
			borderColor: currentColors.primary
		}
	}[type];

	// Position classes
	$: positionClasses = {
		'top-left': 'top-4 left-4',
		'top-right': 'top-4 right-4',
		'bottom-left': 'bottom-4 left-4',
		'bottom-right': 'bottom-4 right-4',
		'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
		'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
	}[position];

	function getTypeColor() {
		return typeConfig.color;
	}

	function startProgress() {
		if (duration <= 0 || !showProgress) return;

		const interval = 50; // Update every 50ms
		const decrement = (100 / duration) * interval;

		progressInterval = setInterval(() => {
			progressValue -= decrement;
			if (progressValue <= 0) {
				progressValue = 0;
				dismiss();
			}
		}, interval);
	}

	function pauseProgress() {
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}
	}

	function resumeProgress() {
		if (duration > 0 && showProgress && progressValue > 0) {
			startProgress();
		}
	}

	function dismiss() {
		visible = false;
		
		// Clean up timers
		if (progressInterval) {
			clearInterval(progressInterval);
		}
		if (autoCloseTimeout) {
			clearTimeout(autoCloseTimeout);
		}

		dispatch('dismiss', { id, type });
		
		// Remove from DOM after animation
		setTimeout(() => {
			dispatch('remove', { id });
		}, 300);
	}

	function handleAction() {
		if (actionCallback) {
			actionCallback();
		}
		dispatch('action', { id, type });
	}

	onMount(() => {
		// Start auto-dismiss timer
		if (duration > 0) {
			if (showProgress) {
				startProgress();
			} else {
				autoCloseTimeout = setTimeout(dismiss, duration);
			}
		}

		// Cleanup on unmount
		return () => {
			if (progressInterval) clearInterval(progressInterval);
			if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
		};
	});
</script>

{#if visible}
	<div 
		class="themed-toast fixed z-50 {positionClasses} {customClass}"
		style={dynamicStyles}
		in:fly={{ y: position.includes('top') ? -100 : 100, duration: 300 }}
		out:fade={{ duration: 300 }}
		on:mouseenter={pauseProgress}
		on:mouseleave={resumeProgress}
		role="alert"
		aria-live="polite"
		aria-atomic="true"
	>
		<div 
			class="flex items-start p-4 max-w-sm w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4"
			style="
				background: {typeConfig.bgColor};
				border-left-color: {typeConfig.borderColor};
			"
		>
			<!-- Icon -->
			{#if showIcon}
				<div class="flex-shrink-0 mr-3">
					<svelte:component 
						this={typeConfig.icon} 
						class="w-5 h-5"
						style="color: {typeConfig.color};"
					/>
				</div>
			{/if}

			<!-- Content -->
			<div class="flex-1 min-w-0">
				{#if title}
					<h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">
						{title}
					</h4>
				{/if}
				{#if message}
					<p class="text-sm text-gray-600 dark:text-gray-300 break-words">
						{message}
					</p>
				{/if}

				<!-- Action Button -->
				{#if actionText && actionCallback}
					<div class="mt-3">
						<Button
							size="xs"
							color="alternative"
							on:click={handleAction}
							class="text-xs"
						>
							{actionText}
						</Button>
					</div>
				{/if}
			</div>

			<!-- Dismiss Button -->
			{#if dismissible}
				<button
					type="button"
					class="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
					on:click={dismiss}
					aria-label="Close notification"
				>
					<XMarkIcon class="w-4 h-4" />
				</button>
			{/if}
		</div>

		<!-- Progress Bar -->
		{#if showProgress && duration > 0}
			<div class="w-full bg-gray-200 dark:bg-gray-700 h-1 mt-2 rounded-full overflow-hidden">
				<div 
					class="h-full transition-all duration-75 ease-linear rounded-full"
					style="
						width: {progressValue}%;
						background-color: {typeConfig.color};
					"
				></div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.themed-toast {
		max-width: 400px;
		min-width: 300px;
	}

	/* Ensure proper z-index and positioning */
	:global(.themed-toast) {
		pointer-events: auto;
	}

	/* Custom shadows based on theme */
	.themed-toast .bg-white {
		box-shadow: 
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);
	}

	:global(.dark .themed-toast .bg-white) {
		box-shadow: 
			0 10px 15px -3px rgba(0, 0, 0, 0.3),
			0 4px 6px -2px rgba(0, 0, 0, 0.2);
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.themed-toast {
			max-width: calc(100vw - 2rem);
			min-width: calc(100vw - 2rem);
			left: 1rem !important;
			right: 1rem !important;
			transform: none !important;
		}

		:global(.themed-toast.top-center),
		:global(.themed-toast.bottom-center) {
			left: 1rem !important;
			transform: none !important;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.themed-toast .bg-white {
			border-width: 2px;
			border-style: solid;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.themed-toast .transition-all {
			transition: none !important;
		}
	}

	/* Focus styles for accessibility */
	.themed-toast button:focus-visible {
		outline: 2px solid var(--toast-icon);
		outline-offset: 2px;
		border-radius: 0.25rem;
	}

	/* Hover effects */
	.themed-toast:hover {
		transform: translateY(-2px);
		transition: transform 0.2s ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.themed-toast:hover {
			transform: none;
		}
	}
</style>