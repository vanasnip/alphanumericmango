<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		Drawer, 
		CloseButton, 
		Tabs, 
		TabItem,
		Card,
		Badge,
		Button,
		Toast
	} from 'flowbite-svelte';
	import { 
		CogIcon, 
		PaletteIcon,
		MicrophoneIcon,
		CommandLineIcon,
		BellIcon,
		CheckCircleIcon,
		ExclamationTriangleIcon,
		InformationCircleIcon
	} from 'flowbite-svelte-icons';
	import ThemeSettings from './ThemeSettings.svelte';
	import VoiceSettings from './VoiceSettings.svelte';
	import TerminalSettings from './TerminalSettings.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Panel state
	export let open = false;
	export let activeTab = 'theme';
	
	// Toast notifications
	let toasts: Array<{
		id: string;
		type: 'success' | 'error' | 'warning' | 'info';
		title: string;
		message: string;
		timeout?: number;
	}> = [];

	// Tab configuration
	const tabs = [
		{
			id: 'theme',
			label: 'Theme',
			icon: PaletteIcon,
			component: ThemeSettings,
			description: 'Customize colors, fonts, and appearance'
		},
		{
			id: 'voice',
			label: 'Voice',
			icon: MicrophoneIcon,
			component: VoiceSettings,
			description: 'Configure voice recognition and audio settings'
		},
		{
			id: 'terminal',
			label: 'Terminal',
			icon: CommandLineIcon,
			component: TerminalSettings,
			description: 'Terminal behavior and command preferences'
		},
		{
			id: 'notifications',
			label: 'Notifications',
			icon: BellIcon,
			component: NotificationSettings,
			description: 'Manage alerts and notification preferences'
		}
	];

	function generateToastId(): string {
		return Math.random().toString(36).substr(2, 9);
	}

	function showToast(
		type: 'success' | 'error' | 'warning' | 'info',
		title: string,
		message: string,
		timeout = 5000
	) {
		const id = generateToastId();
		const toast = { id, type, title, message, timeout };
		
		toasts = [...toasts, toast];
		
		if (timeout > 0) {
			setTimeout(() => {
				dismissToast(id);
			}, timeout);
		}
	}

	function dismissToast(id: string) {
		toasts = toasts.filter(t => t.id !== id);
	}

	function handleSettingsChange(event: CustomEvent) {
		const { detail } = event;
		showToast('success', 'Settings Updated', 'Your changes have been applied successfully');
		dispatch('change', detail);
	}

	function handleSettingsError(event: CustomEvent) {
		const { detail } = event;
		showToast('error', 'Settings Error', detail.error || 'An error occurred while updating settings');
		dispatch('error', detail);
	}

	function handleThemeImport(event: CustomEvent) {
		const { detail } = event;
		if (detail.success) {
			showToast('success', 'Theme Imported', 'Theme has been imported successfully');
		} else {
			showToast('error', 'Import Failed', detail.error || 'Failed to import theme');
		}
	}

	function handleThemeExport() {
		showToast('info', 'Theme Exported', 'Theme has been downloaded to your device');
	}

	function handleClose() {
		open = false;
		dispatch('close');
	}

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			handleClose();
		}
	}

	onMount(() => {
		// Add global keydown listener
		document.addEventListener('keydown', handleKeydown);
		
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<!-- Settings Drawer -->
<Drawer
	bind:open
	position="right"
	width="w-96 lg:w-[32rem]"
	class="settings-drawer"
	backdrop={true}
	activateClickOutside={true}
>
	<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center gap-3">
			<CogIcon class="w-6 h-6 text-primary-600" />
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
				Settings
			</h2>
		</div>
		<CloseButton on:click={handleClose} />
	</div>

	<div class="p-4 h-full overflow-y-auto">
		<Tabs 
			bind:activeTab 
			class="settings-tabs"
			contentClass="mt-4"
		>
			{#each tabs as tab (tab.id)}
				<TabItem 
					name={tab.id} 
					title={tab.label}
					class="flex items-center gap-2"
				>
					<svelte:component this={tab.icon} class="w-4 h-4" />
					<span>{tab.label}</span>
					
					<div slot="content" class="space-y-4">
						<!-- Tab Description -->
						<Card class="!p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
							<p class="text-sm text-blue-800 dark:text-blue-200">
								{tab.description}
							</p>
						</Card>

						<!-- Tab Content -->
						<svelte:component 
							this={tab.component}
							on:change={handleSettingsChange}
							on:error={handleSettingsError}
							on:import={handleThemeImport}
							on:export={handleThemeExport}
						/>
					</div>
				</TabItem>
			{/each}
		</Tabs>
	</div>

	<!-- Footer -->
	<div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
		<div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
			<span>Voice Terminal Hybrid v1.0.0</span>
			<Button size="xs" color="alternative" on:click={handleClose}>
				Close
			</Button>
		</div>
	</div>
</Drawer>

<!-- Toast Notifications Container -->
<div class="toast-container fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
	{#each toasts as toast (toast.id)}
		<div class="pointer-events-auto">
			<Toast
				color={toast.type === 'success' ? 'green' : 
					  toast.type === 'error' ? 'red' : 
					  toast.type === 'warning' ? 'yellow' : 'blue'}
				dismissable
				on:close={() => dismissToast(toast.id)}
				class="min-w-80"
			>
				<svelte:fragment slot="icon">
					{#if toast.type === 'success'}
						<CheckCircleIcon class="w-5 h-5" />
					{:else if toast.type === 'error'}
						<ExclamationTriangleIcon class="w-5 h-5" />
					{:else if toast.type === 'warning'}
						<ExclamationTriangleIcon class="w-5 h-5" />
					{:else}
						<InformationCircleIcon class="w-5 h-5" />
					{/if}
				</svelte:fragment>
				
				<div>
					<div class="font-medium">{toast.title}</div>
					<div class="text-sm opacity-90">{toast.message}</div>
				</div>
			</Toast>
		</div>
	{/each}
</div>

<style>
	:global(.settings-drawer) {
		max-width: none !important;
	}

	:global(.settings-tabs .tab-content) {
		padding: 0;
	}

	:global(.settings-tabs .tabs-content) {
		max-height: none;
		overflow: visible;
	}

	.toast-container {
		max-width: calc(100vw - 2rem);
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		:global(.settings-drawer) {
			width: 100% !important;
			max-width: 100% !important;
		}

		.toast-container {
			left: 1rem;
			right: 1rem;
			top: 1rem;
		}
	}

	/* Custom scrollbar for settings drawer */
	:global(.settings-drawer .overflow-y-auto::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.settings-drawer .overflow-y-auto::-webkit-scrollbar-track) {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 4px;
	}

	:global(.settings-drawer .overflow-y-auto::-webkit-scrollbar-thumb) {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 4px;
	}

	:global(.settings-drawer .overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: rgba(0, 0, 0, 0.5);
	}

	/* Dark mode scrollbar */
	:global(.dark .settings-drawer .overflow-y-auto::-webkit-scrollbar-track) {
		background: rgba(255, 255, 255, 0.1);
	}

	:global(.dark .settings-drawer .overflow-y-auto::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.3);
	}

	:global(.dark .settings-drawer .overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: rgba(255, 255, 255, 0.5);
	}
</style>