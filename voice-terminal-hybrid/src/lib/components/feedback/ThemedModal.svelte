<script lang="ts">
	import { 
		Modal,
		Button,
		ButtonGroup,
		Badge
	} from 'flowbite-svelte';
	import { 
		XMarkIcon,
		ExclamationTriangleIcon,
		InformationCircleIcon,
		CheckCircleIcon,
		ExclamationCircleIcon
	} from 'flowbite-svelte-icons';
	import { themeStore, colors } from '$lib/stores/theme.js';
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let open = false;
	export let title = '';
	export let type: 'default' | 'success' | 'error' | 'warning' | 'info' | 'confirmation' = 'default';
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let backdrop = true;
	export let persistent = false; // Prevent closing on backdrop click
	export let showCloseButton = true;
	export let showHeader = true;
	export let showFooter = true;
	export let autoclose = false;
	export let outsideclose = true;
	export let customClass = '';
	
	// Footer configuration
	export let primaryAction = 'Confirm';
	export let secondaryAction = 'Cancel';
	export let showPrimaryAction = true;
	export let showSecondaryAction = true;
	export let primaryActionColor: 'primary' | 'secondary' | 'success' | 'error' | 'warning' = 'primary';
	export let primaryActionDisabled = false;
	export let primaryActionLoading = false;

	// Content slots
	export let headerContent = '';
	export let bodyContent = '';
	export let footerContent = '';

	// Theme integration
	$: currentColors = $colors;
	$: dynamicStyles = `
		--modal-bg: ${currentColors.surface};
		--modal-border: ${currentColors.primary};
		--modal-text: ${currentColors.text};
		--modal-overlay: color-mix(in srgb, ${currentColors.background} 80%, transparent);
		--modal-accent: ${getTypeColor()};
	`;

	// Type configurations
	$: typeConfig = {
		default: {
			icon: null,
			color: currentColors.text,
			headerBg: currentColors.surface,
			borderColor: currentColors.primary
		},
		success: {
			icon: CheckCircleIcon,
			color: currentColors.success,
			headerBg: `color-mix(in srgb, ${currentColors.success} 10%, ${currentColors.surface})`,
			borderColor: currentColors.success
		},
		error: {
			icon: ExclamationCircleIcon,
			color: currentColors.error,
			headerBg: `color-mix(in srgb, ${currentColors.error} 10%, ${currentColors.surface})`,
			borderColor: currentColors.error
		},
		warning: {
			icon: ExclamationTriangleIcon,
			color: currentColors.warning,
			headerBg: `color-mix(in srgb, ${currentColors.warning} 10%, ${currentColors.surface})`,
			borderColor: currentColors.warning
		},
		info: {
			icon: InformationCircleIcon,
			color: currentColors.primary,
			headerBg: `color-mix(in srgb, ${currentColors.primary} 10%, ${currentColors.surface})`,
			borderColor: currentColors.primary
		},
		confirmation: {
			icon: ExclamationTriangleIcon,
			color: currentColors.warning,
			headerBg: `color-mix(in srgb, ${currentColors.warning} 10%, ${currentColors.surface})`,
			borderColor: currentColors.warning
		}
	}[type];

	// Size configurations
	$: sizeClasses = {
		xs: 'max-w-md',
		sm: 'max-w-lg',
		md: 'max-w-2xl',
		lg: 'max-w-4xl',
		xl: 'max-w-7xl'
	}[size];

	function getTypeColor() {
		return typeConfig.color;
	}

	function handleClose() {
		if (persistent) return;
		
		open = false;
		dispatch('close');
	}

	function handlePrimaryAction() {
		dispatch('primary-action', { type, action: primaryAction });
		if (!persistent) {
			open = false;
		}
	}

	function handleSecondaryAction() {
		dispatch('secondary-action', { type, action: secondaryAction });
		if (!persistent) {
			open = false;
		}
	}

	function handleBackdropClick() {
		if (outsideclose && !persistent) {
			handleClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !persistent) {
			handleClose();
		} else if (event.key === 'Enter' && type === 'confirmation') {
			handlePrimaryAction();
		}
	}

	onMount(() => {
		// Add global keydown listener
		const handleGlobalKeydown = (event: KeyboardEvent) => {
			if (open) {
				handleKeydown(event);
			}
		};

		document.addEventListener('keydown', handleGlobalKeydown);
		
		return () => {
			document.removeEventListener('keydown', handleGlobalKeydown);
		};
	});
</script>

<Modal
	bind:open
	{autoclose}
	outsideclose={outsideclose && !persistent}
	dismissable={!persistent}
	class="themed-modal {customClass}"
	bodyClass="p-0"
	headerClass="hidden"
	footerClass="hidden"
	{size}
	style={dynamicStyles}
	on:close={handleClose}
>
	<div class="modal-content" style="background: {currentColors.surface}; color: {currentColors.text};">
		<!-- Custom Header -->
		{#if showHeader}
			<div 
				class="modal-header flex items-center justify-between p-4 border-b"
				style="
					background: {typeConfig.headerBg};
					border-color: {typeConfig.borderColor};
				"
			>
				<div class="flex items-center gap-3">
					{#if typeConfig.icon}
						<svelte:component 
							this={typeConfig.icon} 
							class="w-6 h-6"
							style="color: {typeConfig.color};"
						/>
					{/if}
					
					<div>
						<h3 class="text-xl font-semibold text-gray-900 dark:text-white">
							{title}
						</h3>
						{#if type !== 'default'}
							<Badge 
								color={type === 'success' ? 'green' : 
									  type === 'error' ? 'red' : 
									  type === 'warning' ? 'yellow' : 
									  type === 'info' ? 'blue' : 'gray'}
								class="mt-1 text-xs"
							>
								{type.charAt(0).toUpperCase() + type.slice(1)}
							</Badge>
						{/if}
					</div>
				</div>

				{#if showCloseButton && !persistent}
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
						on:click={handleClose}
						aria-label="Close modal"
					>
						<XMarkIcon class="w-5 h-5" />
					</button>
				{/if}
			</div>
		{/if}

		<!-- Modal Body -->
		<div class="modal-body p-6">
			{#if bodyContent}
				<div class="prose prose-sm max-w-none dark:prose-invert">
					{@html bodyContent}
				</div>
			{:else}
				<slot>
					<p class="text-gray-600 dark:text-gray-300">Modal content goes here.</p>
				</slot>
			{/if}
		</div>

		<!-- Custom Footer -->
		{#if showFooter}
			<div class="modal-footer flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
				{#if footerContent}
					<div class="footer-content">
						{@html footerContent}
					</div>
				{:else}
					<slot name="footer">
						<ButtonGroup>
							{#if showSecondaryAction}
								<Button
									color="alternative"
									on:click={handleSecondaryAction}
								>
									{secondaryAction}
								</Button>
							{/if}
							
							{#if showPrimaryAction}
								<Button
									color={primaryActionColor}
									disabled={primaryActionDisabled}
									on:click={handlePrimaryAction}
									class="flex items-center gap-2"
								>
									{#if primaryActionLoading}
										<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
									{/if}
									{primaryAction}
								</Button>
							{/if}
						</ButtonGroup>
					</slot>
				{/if}
			</div>
		{/if}
	</div>
</Modal>

<!-- Custom backdrop for persistent modals -->
{#if open && persistent}
	<div 
		class="fixed inset-0 z-40 bg-black bg-opacity-50 backdrop-blur-sm"
		role="presentation"
		aria-hidden="true"
		on:click|stopPropagation
		on:keydown|stopPropagation
	></div>
{/if}

<style>
	:global(.themed-modal) {
		z-index: 50;
	}

	:global(.themed-modal .modal-content) {
		background: var(--modal-bg);
		color: var(--modal-text);
		border-radius: 0.75rem;
		box-shadow: 
			0 25px 50px -12px rgba(0, 0, 0, 0.25),
			0 0 0 1px var(--modal-border);
		max-height: 90vh;
		overflow-y: auto;
	}

	:global(.dark .themed-modal .modal-content) {
		box-shadow: 
			0 25px 50px -12px rgba(0, 0, 0, 0.5),
			0 0 0 1px var(--modal-border);
	}

	/* Header styling */
	.modal-header {
		border-top-left-radius: 0.75rem;
		border-top-right-radius: 0.75rem;
	}

	/* Body styling */
	.modal-body {
		max-height: 60vh;
		overflow-y: auto;
	}

	/* Footer styling */
	.modal-footer {
		border-bottom-left-radius: 0.75rem;
		border-bottom-right-radius: 0.75rem;
		background: color-mix(in srgb, var(--modal-bg) 95%, var(--modal-border));
	}

	/* Custom scrollbar for modal body */
	.modal-body::-webkit-scrollbar {
		width: 8px;
	}

	.modal-body::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 4px;
	}

	.modal-body::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 4px;
	}

	.modal-body::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.5);
	}

	/* Dark mode scrollbar */
	:global(.dark) .modal-body::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.1);
	}

	:global(.dark) .modal-body::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.3);
	}

	:global(.dark) .modal-body::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.5);
	}

	/* Animation improvements */
	:global(.themed-modal) {
		animation: modalFadeIn 0.3s ease-out;
	}

	@keyframes modalFadeIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* Close button hover effect */
	.modal-header button:hover {
		background: color-mix(in srgb, var(--modal-accent) 10%, transparent);
	}

	/* Focus styles */
	.modal-header button:focus-visible {
		outline: 2px solid var(--modal-accent);
		outline-offset: 2px;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		:global(.themed-modal .modal-content) {
			margin: 1rem;
			max-height: calc(100vh - 2rem);
		}

		.modal-header {
			padding: 1rem;
		}

		.modal-body {
			padding: 1rem;
			max-height: calc(70vh - 8rem);
		}

		.modal-footer {
			padding: 1rem;
			flex-direction: column;
			gap: 0.5rem;
		}

		:global(.themed-modal .modal-footer .button-group) {
			flex-direction: column;
			width: 100%;
		}

		:global(.themed-modal .modal-footer .button) {
			width: 100%;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		:global(.themed-modal .modal-content) {
			border-width: 2px;
		}

		.modal-header {
			border-bottom-width: 2px;
		}

		.modal-footer {
			border-top-width: 2px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		:global(.themed-modal) {
			animation: none !important;
		}

		@keyframes modalFadeIn {
			from, to {
				opacity: 1;
				transform: none;
			}
		}
	}

	/* Loading state for primary action */
	:global(.themed-modal .button.loading) {
		opacity: 0.8;
		pointer-events: none;
	}

	/* Type-specific styling */
	:global(.themed-modal.type-error .modal-header) {
		background: color-mix(in srgb, var(--color-error) 10%, var(--modal-bg));
		border-color: var(--color-error);
	}

	:global(.themed-modal.type-success .modal-header) {
		background: color-mix(in srgb, var(--color-success) 10%, var(--modal-bg));
		border-color: var(--color-success);
	}

	:global(.themed-modal.type-warning .modal-header) {
		background: color-mix(in srgb, var(--color-warning) 10%, var(--modal-bg));
		border-color: var(--color-warning);
	}

	:global(.themed-modal.type-info .modal-header) {
		background: color-mix(in srgb, var(--color-primary) 10%, var(--modal-bg));
		border-color: var(--color-primary);
	}
</style>