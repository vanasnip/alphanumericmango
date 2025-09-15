<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		Card, 
		Label, 
		Range, 
		Toggle, 
		Select,
		Button,
		Alert,
		Listgroup,
		ListgroupItem,
		Badge
	} from 'flowbite-svelte';
	import { 
		BellIcon,
		SpeakerWaveIcon,
		ExclamationTriangleIcon,
		CheckCircleIcon,
		InformationCircleIcon,
		XMarkIcon
	} from 'flowbite-svelte-icons';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Notification settings state
	let enableNotifications = true;
	let enableSounds = true;
	let notificationVolume = 0.5;
	let showDesktopNotifications = true;
	let showCommandComplete = true;
	let showErrors = true;
	let showWarnings = true;
	let showSuccess = true;
	let showVoiceStatus = true;
	let notificationDuration = 5000;
	let soundTheme = 'default';
	let customSounds = false;
	
	// Notification permission state
	let permissionStatus = 'default';
	let isCheckingPermission = false;

	// Sound themes
	const soundThemes = [
		{ value: 'default', name: 'Default' },
		{ value: 'minimal', name: 'Minimal' },
		{ value: 'retro', name: 'Retro Terminal' },
		{ value: 'modern', name: 'Modern UI' },
		{ value: 'nature', name: 'Nature Sounds' },
		{ value: 'custom', name: 'Custom Sounds' }
	];

	// Notification types with their settings
	let notificationTypes = [
		{
			id: 'command-complete',
			name: 'Command Completed',
			description: 'When a command finishes execution',
			enabled: true,
			sound: true,
			desktop: false,
			priority: 'low'
		},
		{
			id: 'command-error',
			name: 'Command Error',
			description: 'When a command fails or returns an error',
			enabled: true,
			sound: true,
			desktop: true,
			priority: 'high'
		},
		{
			id: 'voice-recognition',
			name: 'Voice Recognition',
			description: 'Voice input status changes',
			enabled: true,
			sound: false,
			desktop: false,
			priority: 'low'
		},
		{
			id: 'system-alerts',
			name: 'System Alerts',
			description: 'Important system messages and warnings',
			enabled: true,
			sound: true,
			desktop: true,
			priority: 'high'
		},
		{
			id: 'theme-changes',
			name: 'Theme Changes',
			description: 'When theme settings are updated',
			enabled: false,
			sound: false,
			desktop: false,
			priority: 'low'
		}
	];

	// Test notification state
	let isTestingNotifications = false;

	onMount(async () => {
		await loadNotificationSettings();
		await checkNotificationPermission();
	});

	async function loadNotificationSettings() {
		try {
			const stored = localStorage.getItem('voice-terminal-notification-settings');
			if (stored) {
				const settings = JSON.parse(stored);
				enableNotifications = settings.enableNotifications ?? true;
				enableSounds = settings.enableSounds ?? true;
				notificationVolume = settings.notificationVolume ?? 0.5;
				showDesktopNotifications = settings.showDesktopNotifications ?? true;
				showCommandComplete = settings.showCommandComplete ?? true;
				showErrors = settings.showErrors ?? true;
				showWarnings = settings.showWarnings ?? true;
				showSuccess = settings.showSuccess ?? true;
				showVoiceStatus = settings.showVoiceStatus ?? true;
				notificationDuration = settings.notificationDuration ?? 5000;
				soundTheme = settings.soundTheme ?? 'default';
				customSounds = settings.customSounds ?? false;
				
				if (settings.notificationTypes) {
					notificationTypes = settings.notificationTypes;
				}
			}
		} catch (error) {
			console.warn('Failed to load notification settings:', error);
		}
	}

	async function saveNotificationSettings() {
		try {
			const settings = {
				enableNotifications,
				enableSounds,
				notificationVolume,
				showDesktopNotifications,
				showCommandComplete,
				showErrors,
				showWarnings,
				showSuccess,
				showVoiceStatus,
				notificationDuration,
				soundTheme,
				customSounds,
				notificationTypes
			};
			
			localStorage.setItem('voice-terminal-notification-settings', JSON.stringify(settings));
			dispatch('change', { notificationSettings: settings });
		} catch (error) {
			dispatch('error', { error: 'Failed to save notification settings' });
		}
	}

	async function checkNotificationPermission() {
		if (!('Notification' in window)) {
			permissionStatus = 'unsupported';
			return;
		}

		permissionStatus = Notification.permission;
	}

	async function requestNotificationPermission() {
		if (!('Notification' in window)) {
			dispatch('error', { error: 'Desktop notifications are not supported in this browser' });
			return;
		}

		isCheckingPermission = true;
		
		try {
			const permission = await Notification.requestPermission();
			permissionStatus = permission;
			
			if (permission === 'granted') {
				showTestNotification('Permission granted!', 'Desktop notifications are now enabled.');
			}
		} catch (error) {
			dispatch('error', { error: 'Failed to request notification permission' });
		} finally {
			isCheckingPermission = false;
		}
	}

	function showTestNotification(title: string, body: string) {
		if (!enableNotifications) return;
		
		if (showDesktopNotifications && permissionStatus === 'granted') {
			const notification = new Notification(title, {
				body,
				icon: '/favicon.ico',
				badge: '/favicon.ico',
				tag: 'voice-terminal-test'
			});

			setTimeout(() => {
				notification.close();
			}, notificationDuration);
		}
	}

	function playTestSound() {
		if (!enableSounds) return;
		
		// Create audio context for test sound
		try {
			const audioContext = new (window.AudioContext || window.webkitAudioContext)();
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();
			
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			
			oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
			oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
			
			gainNode.gain.setValueAtTime(notificationVolume * 0.3, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
			
			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + 0.1);
		} catch (error) {
			console.warn('Failed to play test sound:', error);
		}
	}

	async function testNotifications() {
		isTestingNotifications = true;
		
		try {
			// Test sound
			if (enableSounds) {
				playTestSound();
			}
			
			// Test desktop notification
			if (showDesktopNotifications && permissionStatus === 'granted') {
				showTestNotification(
					'Voice Terminal Test',
					'This is a test notification to verify your settings.'
				);
			}
			
			// Test in-app notification (would normally be handled by toast system)
			dispatch('test-notification', {
				type: 'info',
				title: 'Test Notification',
				message: 'Notification test completed successfully!'
			});
			
		} catch (error) {
			dispatch('error', { error: 'Failed to test notifications' });
		} finally {
			isTestingNotifications = false;
		}
	}

	function updateNotificationType(index: number, field: string, value: any) {
		notificationTypes[index][field] = value;
		notificationTypes = [...notificationTypes]; // Trigger reactivity
		saveNotificationSettings();
	}

	function resetToDefaults() {
		enableNotifications = true;
		enableSounds = true;
		notificationVolume = 0.5;
		showDesktopNotifications = true;
		showCommandComplete = true;
		showErrors = true;
		showWarnings = true;
		showSuccess = true;
		showVoiceStatus = true;
		notificationDuration = 5000;
		soundTheme = 'default';
		customSounds = false;
		
		notificationTypes = [
			{
				id: 'command-complete',
				name: 'Command Completed',
				description: 'When a command finishes execution',
				enabled: true,
				sound: true,
				desktop: false,
				priority: 'low'
			},
			{
				id: 'command-error',
				name: 'Command Error',
				description: 'When a command fails or returns an error',
				enabled: true,
				sound: true,
				desktop: true,
				priority: 'high'
			},
			{
				id: 'voice-recognition',
				name: 'Voice Recognition',
				description: 'Voice input status changes',
				enabled: true,
				sound: false,
				desktop: false,
				priority: 'low'
			},
			{
				id: 'system-alerts',
				name: 'System Alerts',
				description: 'Important system messages and warnings',
				enabled: true,
				sound: true,
				desktop: true,
				priority: 'high'
			},
			{
				id: 'theme-changes',
				name: 'Theme Changes',
				description: 'When theme settings are updated',
				enabled: false,
				sound: false,
				desktop: false,
				priority: 'low'
			}
		];
		
		saveNotificationSettings();
	}

	// Reactive save
	$: {
		if (typeof window !== 'undefined') {
			saveNotificationSettings();
		}
	}
</script>

<div class="notification-settings-container space-y-6">
	<!-- Permission Check -->
	{#if permissionStatus === 'denied'}
		<Alert color="red">
			<ExclamationTriangleIcon slot="icon" class="w-4 h-4" />
			<span class="font-medium">Desktop Notifications Disabled</span>
			<div class="mt-2">
				<p class="text-sm">Desktop notifications have been blocked. Please enable them in your browser settings.</p>
			</div>
		</Alert>
	{:else if permissionStatus === 'default'}
		<Alert color="yellow">
			<InformationCircleIcon slot="icon" class="w-4 h-4" />
			<span class="font-medium">Desktop Notifications Permission</span>
			<div class="mt-2">
				<p class="text-sm">Desktop notifications require permission to function properly.</p>
				<Button 
					size="xs" 
					color="alternative" 
					class="mt-2"
					on:click={requestNotificationPermission}
					disabled={isCheckingPermission}
				>
					{isCheckingPermission ? 'Requesting...' : 'Grant Permission'}
				</Button>
			</div>
		</Alert>
	{:else if permissionStatus === 'granted'}
		<Alert color="green">
			<CheckCircleIcon slot="icon" class="w-4 h-4" />
			<span class="font-medium">Desktop Notifications Enabled</span>
			<p class="text-sm mt-1">You will receive desktop notifications when enabled below.</p>
		</Alert>
	{/if}

	<!-- General Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			General Settings
		</h3>
		
		<div class="space-y-4">
			<!-- Enable Notifications -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Enable Notifications</Label>
					<p class="text-xs text-gray-500 mt-1">Master switch for all notifications</p>
				</div>
				<Toggle bind:checked={enableNotifications} />
			</div>

			<!-- Desktop Notifications -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Desktop Notifications</Label>
					<p class="text-xs text-gray-500 mt-1">Show system notifications outside the browser</p>
				</div>
				<Toggle 
					bind:checked={showDesktopNotifications} 
					disabled={!enableNotifications || permissionStatus !== 'granted'} 
				/>
			</div>

			<!-- Notification Duration -->
			<div>
				<Label for="notification-duration" class="mb-2 block">
					Notification Duration: {notificationDuration / 1000}s
				</Label>
				<Range
					id="notification-duration"
					min="1000"
					max="30000"
					step="1000"
					bind:value={notificationDuration}
					disabled={!enableNotifications}
					class="w-full"
				/>
			</div>
		</div>
	</Card>

	<!-- Sound Settings -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Sound Settings
		</h3>
		
		<div class="space-y-4">
			<!-- Enable Sounds -->
			<div class="flex items-center justify-between">
				<div>
					<Label class="text-sm font-medium">Enable Sounds</Label>
					<p class="text-xs text-gray-500 mt-1">Play audio alerts for notifications</p>
				</div>
				<Toggle bind:checked={enableSounds} disabled={!enableNotifications} />
			</div>

			{#if enableSounds}
				<!-- Volume -->
				<div>
					<Label for="notification-volume" class="mb-2 block">
						Volume: {Math.round(notificationVolume * 100)}%
					</Label>
					<Range
						id="notification-volume"
						min="0.0"
						max="1.0"
						step="0.05"
						bind:value={notificationVolume}
						disabled={!enableNotifications || !enableSounds}
						class="w-full"
					/>
				</div>

				<!-- Sound Theme -->
				<div>
					<Label for="sound-theme" class="mb-2 block">Sound Theme</Label>
					<Select
						id="sound-theme"
						bind:value={soundTheme}
						disabled={!enableNotifications || !enableSounds}
						class="w-full"
					>
						{#each soundThemes as theme (theme.value)}
							<option value={theme.value}>{theme.name}</option>
						{/each}
					</Select>
				</div>

				<!-- Test Sound -->
				<div class="flex items-center justify-between">
					<div>
						<Label class="text-sm font-medium">Test Sound</Label>
						<p class="text-xs text-gray-500 mt-1">Play a sample notification sound</p>
					</div>
					<Button
						size="sm"
						color="primary"
						disabled={!enableNotifications || !enableSounds}
						on:click={playTestSound}
						class="flex items-center gap-2"
					>
						<SpeakerWaveIcon class="w-4 h-4" />
						Play
					</Button>
				</div>
			{/if}
		</div>
	</Card>

	<!-- Notification Types -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Notification Types
		</h3>
		
		<Listgroup class="space-y-0">
			{#each notificationTypes as notificationType, index (notificationType.id)}
				<ListgroupItem class="!p-4">
					<div class="flex items-start justify-between w-full">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-1">
								<h4 class="text-sm font-medium text-gray-900 dark:text-white">
									{notificationType.name}
								</h4>
								<Badge 
									color={notificationType.priority === 'high' ? 'red' : 
										  notificationType.priority === 'medium' ? 'yellow' : 'gray'}
									class="text-xs"
								>
									{notificationType.priority}
								</Badge>
							</div>
							<p class="text-xs text-gray-500">
								{notificationType.description}
							</p>
							
							<!-- Individual controls -->
							<div class="flex items-center gap-4 mt-3">
								<label class="flex items-center gap-2 text-xs">
									<input 
										type="checkbox" 
										bind:checked={notificationType.enabled}
										on:change={() => updateNotificationType(index, 'enabled', notificationType.enabled)}
										disabled={!enableNotifications}
										class="rounded border-gray-300"
									/>
									<span>Enabled</span>
								</label>
								
								<label class="flex items-center gap-2 text-xs">
									<input 
										type="checkbox" 
										bind:checked={notificationType.sound}
										on:change={() => updateNotificationType(index, 'sound', notificationType.sound)}
										disabled={!enableNotifications || !enableSounds || !notificationType.enabled}
										class="rounded border-gray-300"
									/>
									<span>Sound</span>
								</label>
								
								<label class="flex items-center gap-2 text-xs">
									<input 
										type="checkbox" 
										bind:checked={notificationType.desktop}
										on:change={() => updateNotificationType(index, 'desktop', notificationType.desktop)}
										disabled={!enableNotifications || !showDesktopNotifications || !notificationType.enabled || permissionStatus !== 'granted'}
										class="rounded border-gray-300"
									/>
									<span>Desktop</span>
								</label>
							</div>
						</div>
					</div>
				</ListgroupItem>
			{/each}
		</Listgroup>
	</Card>

	<!-- Testing -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Testing
		</h3>
		
		<div class="flex items-center justify-between">
			<div>
				<Label class="text-sm font-medium">Test Notifications</Label>
				<p class="text-xs text-gray-500 mt-1">Send a test notification to verify your settings</p>
			</div>
			<Button
				size="sm"
				color="primary"
				disabled={!enableNotifications || isTestingNotifications}
				on:click={testNotifications}
				class="flex items-center gap-2"
			>
				<BellIcon class="w-4 h-4" />
				{isTestingNotifications ? 'Testing...' : 'Test'}
			</Button>
		</div>
	</Card>

	<!-- Actions -->
	<Card class="p-6">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
			Actions
		</h3>
		
		<Button
			color="alternative"
			class="w-full"
			on:click={resetToDefaults}
		>
			Reset to Defaults
		</Button>
	</Card>
</div>

<style>
	.notification-settings-container :global(.range-slider) {
		margin: 0.5rem 0;
	}
	
	.notification-settings-container :global(.toggle) {
		flex-shrink: 0;
	}

	.notification-settings-container :global(.listgroup-item) {
		border-left: none;
		border-right: none;
	}

	.notification-settings-container :global(.listgroup-item:first-child) {
		border-top: none;
		border-radius: 0.5rem 0.5rem 0 0;
	}

	.notification-settings-container :global(.listgroup-item:last-child) {
		border-bottom: none;
		border-radius: 0 0 0.5rem 0.5rem;
	}
</style>