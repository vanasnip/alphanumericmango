<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import ThemedToast from './ThemedToast.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let maxToasts = 5;
	export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' = 'top-right';
	export let globalDuration = 5000;
	export let enableSounds = false;
	export let customClass = '';

	// Toast store
	interface ToastItem {
		id: string;
		type: 'success' | 'error' | 'warning' | 'info';
		title?: string;
		message: string;
		duration?: number;
		dismissible?: boolean;
		showIcon?: boolean;
		showProgress?: boolean;
		actionText?: string;
		actionCallback?: () => void;
	}

	const toasts = writable<ToastItem[]>([]);
	let toastList: ToastItem[] = [];

	// Subscribe to toast changes
	const unsubscribe = toasts.subscribe(value => {
		toastList = value;
	});

	// Sound configurations
	const soundMap = {
		success: { frequency: [523, 659, 784], duration: 200 },
		error: { frequency: [349, 294, 220], duration: 300 },
		warning: { frequency: [440, 523, 440], duration: 250 },
		info: { frequency: [523, 659], duration: 150 }
	};

	// Public API for adding toasts
	export function addToast(toast: Omit<ToastItem, 'id'>) {
		const id = generateId();
		const newToast: ToastItem = {
			id,
			duration: globalDuration,
			dismissible: true,
			showIcon: true,
			showProgress: true,
			...toast
		};

		toasts.update(current => {
			let updated = [newToast, ...current];
			
			// Limit number of toasts
			if (updated.length > maxToasts) {
				updated = updated.slice(0, maxToasts);
			}
			
			return updated;
		});

		// Play sound if enabled
		if (enableSounds) {
			playSound(toast.type);
		}

		dispatch('toast-added', { toast: newToast });
		return id;
	}

	// Convenience methods
	export function success(message: string, title?: string, options?: Partial<ToastItem>) {
		return addToast({ type: 'success', message, title, ...options });
	}

	export function error(message: string, title?: string, options?: Partial<ToastItem>) {
		return addToast({ type: 'error', message, title, duration: 0, ...options }); // Errors don't auto-dismiss by default
	}

	export function warning(message: string, title?: string, options?: Partial<ToastItem>) {
		return addToast({ type: 'warning', message, title, ...options });
	}

	export function info(message: string, title?: string, options?: Partial<ToastItem>) {
		return addToast({ type: 'info', message, title, ...options });
	}

	// Remove specific toast
	export function removeToast(id: string) {
		toasts.update(current => current.filter(toast => toast.id !== id));
		dispatch('toast-removed', { id });
	}

	// Clear all toasts
	export function clearAll() {
		const count = toastList.length;
		toasts.set([]);
		dispatch('toasts-cleared', { count });
	}

	// Update existing toast
	export function updateToast(id: string, updates: Partial<ToastItem>) {
		toasts.update(current => 
			current.map(toast => 
				toast.id === id ? { ...toast, ...updates } : toast
			)
		);
		dispatch('toast-updated', { id, updates });
	}

	function generateId(): string {
		return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
	}

	async function playSound(type: 'success' | 'error' | 'warning' | 'info') {
		if (!enableSounds) return;

		try {
			const audioContext = new (window.AudioContext || window.webkitAudioContext)();
			const sound = soundMap[type];
			
			for (let i = 0; i < sound.frequency.length; i++) {
				const oscillator = audioContext.createOscillator();
				const gainNode = audioContext.createGain();
				
				oscillator.connect(gainNode);
				gainNode.connect(audioContext.destination);
				
				oscillator.frequency.setValueAtTime(sound.frequency[i], audioContext.currentTime + i * 0.1);
				gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + i * 0.1);
				gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + sound.duration / 1000);
				
				oscillator.start(audioContext.currentTime + i * 0.1);
				oscillator.stop(audioContext.currentTime + i * 0.1 + sound.duration / 1000);
			}
		} catch (error) {
			console.warn('Failed to play toast sound:', error);
		}
	}

	function handleToastDismiss(event) {
		const { id } = event.detail;
		removeToast(id);
	}

	function handleToastAction(event) {
		const { id, type } = event.detail;
		dispatch('toast-action', { id, type });
	}

	// Global keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		// Ctrl/Cmd + Shift + C to clear all toasts
		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
			event.preventDefault();
			clearAll();
		}
		// Escape to dismiss latest toast
		else if (event.key === 'Escape' && toastList.length > 0) {
			const latestToast = toastList[0];
			if (latestToast.dismissible !== false) {
				removeToast(latestToast.id);
			}
		}
	}

	onMount(() => {
		// Add global event listeners
		document.addEventListener('keydown', handleKeydown);

		// Expose global toast API
		window.toast = {
			add: addToast,
			success,
			error,
			warning,
			info,
			remove: removeToast,
			clear: clearAll,
			update: updateToast
		};

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			delete window.toast;
		};
	});

	onDestroy(() => {
		unsubscribe();
	});

	// Position-based container styles
	$: containerClass = `toast-container-${position} ${customClass}`;
	$: isTop = position.includes('top');
	$: isCenter = position.includes('center');
</script>

<!-- Toast Container -->
<div class="toast-manager {containerClass}" aria-live="polite" aria-label="Notifications">
	{#each toastList as toast (toast.id)}
		<div class="toast-wrapper">
			<ThemedToast
				id={toast.id}
				type={toast.type}
				title={toast.title || ''}
				message={toast.message}
				duration={toast.duration || globalDuration}
				dismissible={toast.dismissible !== false}
				{position}
				showIcon={toast.showIcon !== false}
				showProgress={toast.showProgress !== false}
				actionText={toast.actionText || ''}
				actionCallback={toast.actionCallback}
				on:dismiss={handleToastDismiss}
				on:action={handleToastAction}
			/>
		</div>
	{/each}
</div>

<!-- Keyboard shortcuts help (optional) -->
{#if toastList.length > 0}
	<div class="toast-shortcuts sr-only" aria-live="polite">
		{toastList.length} notification{toastList.length !== 1 ? 's' : ''} active. 
		Press Escape to dismiss latest, Ctrl+Shift+C to clear all.
	</div>
{/if}

<style>
	.toast-manager {
		position: fixed;
		z-index: 1000;
		pointer-events: none;
	}

	.toast-wrapper {
		margin-bottom: 0.5rem;
		pointer-events: auto;
	}

	/* Position-specific styles */
	.toast-container-top-left {
		top: 1rem;
		left: 1rem;
	}

	.toast-container-top-right {
		top: 1rem;
		right: 1rem;
	}

	.toast-container-bottom-left {
		bottom: 1rem;
		left: 1rem;
	}

	.toast-container-bottom-right {
		bottom: 1rem;
		right: 1rem;
	}

	.toast-container-top-center {
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
	}

	.toast-container-bottom-center {
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
	}

	/* Reverse order for bottom positions */
	.toast-container-bottom-left,
	.toast-container-bottom-right,
	.toast-container-bottom-center {
		display: flex;
		flex-direction: column-reverse;
	}

	.toast-container-bottom-left .toast-wrapper,
	.toast-container-bottom-right .toast-wrapper,
	.toast-container-bottom-center .toast-wrapper {
		margin-bottom: 0;
		margin-top: 0.5rem;
	}

	/* Screen reader only class */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.toast-manager {
			left: 1rem !important;
			right: 1rem !important;
			transform: none !important;
		}

		.toast-container-top-center,
		.toast-container-bottom-center {
			left: 1rem;
			right: 1rem;
			transform: none;
		}
	}

	/* Accessibility improvements */
	@media (prefers-reduced-motion: reduce) {
		.toast-wrapper {
			transition: none !important;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.toast-manager {
			filter: contrast(1.2);
		}
	}
</style>

<!-- Global type definitions for window.toast -->
<script lang="ts">
	declare global {
		interface Window {
			toast: {
				add: (toast: Omit<ToastItem, 'id'>) => string;
				success: (message: string, title?: string, options?: Partial<ToastItem>) => string;
				error: (message: string, title?: string, options?: Partial<ToastItem>) => string;
				warning: (message: string, title?: string, options?: Partial<ToastItem>) => string;
				info: (message: string, title?: string, options?: Partial<ToastItem>) => string;
				remove: (id: string) => void;
				clear: () => void;
				update: (id: string, updates: Partial<ToastItem>) => void;
			};
		}
	}
</script>