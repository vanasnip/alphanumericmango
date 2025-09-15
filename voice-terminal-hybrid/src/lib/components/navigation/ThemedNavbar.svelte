<script lang="ts">
	import { 
		Navbar, 
		NavBrand, 
		NavLi, 
		NavUl, 
		NavHamburger,
		Button,
		Badge,
		Avatar,
		Dropdown,
		DropdownItem,
		DropdownDivider,
		Search,
		DarkMode
	} from 'flowbite-svelte';
	import { 
		CommandLineIcon,
		CogIcon,
		MicrophoneIcon,
		SpeakerWaveIcon,
		UserCircleIcon,
		ArrowRightOnRectangleIcon,
		QuestionMarkCircleIcon,
		BellIcon,
		MagnifyingGlassIcon
	} from 'flowbite-svelte-icons';
	import { themeStore, colors } from '$lib/stores/theme.js';
	import VoiceIndicator from '../themed/VoiceIndicator.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let brand = 'Voice Terminal Hybrid';
	export let showSearch = true;
	export let showVoiceIndicator = true;
	export let showNotifications = true;
	export let showUserMenu = true;
	export let showThemeToggle = true;
	export let sticky = true;
	export let fluid = false;
	export let customClass = '';

	// Navigation state
	let searchQuery = '';
	let isVoiceActive = false;
	let voiceState = 'idle';
	let notificationCount = 0;
	let userName = 'User';
	let userEmail = 'user@example.com';
	let isMenuOpen = false;

	// Theme integration
	$: currentColors = $colors;
	$: dynamicStyles = `
		--navbar-bg: ${currentColors.surface};
		--navbar-border: ${currentColors.primary};
		--navbar-text: ${currentColors.text};
		--navbar-accent: ${currentColors.primary};
	`;

	// Navigation items
	const navItems = [
		{ label: 'Terminal', href: '/', icon: CommandLineIcon, active: true },
		{ label: 'Projects', href: '/projects', icon: null },
		{ label: 'Settings', href: '/settings', icon: CogIcon },
		{ label: 'Help', href: '/help', icon: QuestionMarkCircleIcon }
	];

	function handleSearch() {
		if (searchQuery.trim()) {
			dispatch('search', { query: searchQuery });
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

	function handleVoiceClick() {
		isVoiceActive = !isVoiceActive;
		voiceState = isVoiceActive ? 'listening' : 'idle';
		dispatch('voice-toggle', { active: isVoiceActive });
	}

	function handleNotificationClick() {
		dispatch('notifications-toggle');
	}

	function handleSettingsClick() {
		dispatch('settings-open');
	}

	function handleUserMenuClick(action: string) {
		dispatch('user-action', { action });
	}

	function handleNavClick(item: typeof navItems[0]) {
		dispatch('nav-click', { item });
	}

	// Update voice state from parent
	export function updateVoiceState(state: string) {
		voiceState = state;
		isVoiceActive = state !== 'idle';
	}

	// Update notification count from parent
	export function updateNotificationCount(count: number) {
		notificationCount = count;
	}
</script>

<Navbar 
	let:hidden 
	let:toggle
	navClass="px-2 sm:px-4 py-2.5 w-full z-20 top-0 left-0 border-b {sticky ? 'sticky' : ''} {customClass}"
	{fluid}
	style={dynamicStyles}
>
	<NavBrand href="/" class="flex items-center">
		<CommandLineIcon class="w-8 h-8 mr-3 text-primary-600" />
		<span class="self-center whitespace-nowrap text-xl font-semibold text-gray-900 dark:text-white">
			{brand}
		</span>
	</NavBrand>

	<!-- Search Bar (Desktop) -->
	{#if showSearch}
		<div class="hidden md:flex items-center flex-1 max-w-md mx-4">
			<Search
				bind:value={searchQuery}
				on:keydown={handleSearchKeydown}
				placeholder="Search commands, projects..."
				class="w-full"
			>
				<Button 
					slot="right" 
					size="sm" 
					on:click={handleSearch}
					class="!p-2"
				>
					<MagnifyingGlassIcon class="w-4 h-4" />
				</Button>
			</Search>
		</div>
	{/if}

	<!-- Right Side Actions -->
	<div class="flex items-center gap-2 md:order-2">
		<!-- Voice Indicator -->
		{#if showVoiceIndicator}
			<div class="hidden sm:block">
				<VoiceIndicator
					state={voiceState}
					size="sm"
					showConfidence={false}
					on:click={handleVoiceClick}
					ariaLabel="Toggle voice input"
				/>
			</div>
		{/if}

		<!-- Notifications -->
		{#if showNotifications}
			<Button 
				color="alternative" 
				class="relative !p-2"
				on:click={handleNotificationClick}
			>
				<BellIcon class="w-5 h-5" />
				{#if notificationCount > 0}
					<Badge 
						color="red" 
						class="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center text-xs font-bold"
					>
						{notificationCount > 99 ? '99+' : notificationCount}
					</Badge>
				{/if}
			</Button>
		{/if}

		<!-- Theme Toggle -->
		{#if showThemeToggle}
			<DarkMode class="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" />
		{/if}

		<!-- User Menu -->
		{#if showUserMenu}
			<Button color="alternative" class="!p-1">
				<Avatar src="" alt="User avatar" size="sm" />
				<span class="sr-only">User menu</span>
			</Button>
			<Dropdown class="w-44">
				<div slot="header" class="px-4 py-3">
					<span class="block text-sm text-gray-900 dark:text-white font-medium">
						{userName}
					</span>
					<span class="block text-sm text-gray-500 dark:text-gray-400 truncate">
						{userEmail}
					</span>
				</div>
				<DropdownItem on:click={() => handleUserMenuClick('profile')}>
					<UserCircleIcon class="w-4 h-4 mr-2" />
					Profile
				</DropdownItem>
				<DropdownItem on:click={handleSettingsClick}>
					<CogIcon class="w-4 h-4 mr-2" />
					Settings
				</DropdownItem>
				<DropdownDivider />
				<DropdownItem on:click={() => handleUserMenuClick('logout')}>
					<ArrowRightOnRectangleIcon class="w-4 h-4 mr-2" />
					Sign out
				</DropdownItem>
			</Dropdown>
		{/if}

		<!-- Mobile Menu Toggle -->
		<NavHamburger on:click={toggle} class="md:hidden" />
	</div>

	<!-- Navigation Menu -->
	<NavUl {hidden} class="order-1 md:order-1">
		{#each navItems as item (item.label)}
			<NavLi 
				href={item.href} 
				active={item.active}
				on:click={() => handleNavClick(item)}
				class="flex items-center"
			>
				{#if item.icon}
					<svelte:component this={item.icon} class="w-4 h-4 mr-2" />
				{/if}
				{item.label}
			</NavLi>
		{/each}

		<!-- Mobile Search -->
		{#if showSearch}
			<li class="md:hidden mt-3">
				<Search
					bind:value={searchQuery}
					on:keydown={handleSearchKeydown}
					placeholder="Search..."
					size="sm"
					class="w-full"
				>
					<Button 
						slot="right" 
						size="sm" 
						on:click={handleSearch}
						class="!p-1"
					>
						<MagnifyingGlassIcon class="w-3 h-3" />
					</Button>
				</Search>
			</li>
		{/if}

		<!-- Mobile Voice Indicator -->
		{#if showVoiceIndicator}
			<li class="sm:hidden mt-3 flex justify-center">
				<VoiceIndicator
					state={voiceState}
					size="md"
					showConfidence={false}
					on:click={handleVoiceClick}
					ariaLabel="Toggle voice input"
				/>
			</li>
		{/if}
	</NavUl>
</Navbar>

<style>
	:global(.navbar) {
		background: var(--navbar-bg);
		border-color: var(--navbar-border);
		color: var(--navbar-text);
	}

	:global(.navbar .nav-brand) {
		color: var(--navbar-text);
	}

	:global(.navbar .nav-link) {
		color: var(--navbar-text);
		transition: color 0.2s ease;
	}

	:global(.navbar .nav-link:hover) {
		color: var(--navbar-accent);
	}

	:global(.navbar .nav-link.active) {
		color: var(--navbar-accent);
		font-weight: 600;
	}

	/* Mobile menu styling */
	:global(.navbar .navbar-collapse) {
		background: var(--navbar-bg);
		border-color: var(--navbar-border);
	}

	/* Search styling */
	:global(.navbar .search-wrapper) {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
	}

	/* Badge positioning */
	:global(.navbar .relative .badge) {
		position: absolute;
		top: -0.25rem;
		right: -0.25rem;
		min-width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: bold;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		:global(.navbar) {
			padding: 0.75rem 1rem;
		}

		:global(.navbar .navbar-brand) {
			font-size: 1.125rem;
		}

		:global(.navbar .nav-link) {
			padding: 0.75rem 1rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		}

		:global(.navbar .nav-link:last-child) {
			border-bottom: none;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		:global(.navbar) {
			border-width: 2px;
		}

		:global(.navbar .nav-link) {
			font-weight: 600;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		:global(.navbar .nav-link) {
			transition: none;
		}
	}
</style>