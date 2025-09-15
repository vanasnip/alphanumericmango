<script lang="ts">
	import { 
		Sidebar, 
		SidebarWrapper, 
		SidebarGroup, 
		SidebarItem,
		SidebarDropdownWrapper,
		SidebarDropdownItem,
		Button,
		Badge,
		Tooltip
	} from 'flowbite-svelte';
	import { 
		CommandLineIcon,
		CogIcon,
		FolderIcon,
		DocumentIcon,
		ClockIcon,
		BookOpenIcon,
		ChartBarIcon,
		UserGroupIcon,
		CloudIcon,
		ArchiveBoxIcon,
		ChevronDoubleLeftIcon,
		ChevronDoubleRightIcon,
		HomeIcon,
		CodeBracketIcon,
		TerminalIcon,
		MicrophoneIcon
	} from 'flowbite-svelte-icons';
	import { themeStore, colors } from '$lib/stores/theme.js';
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	// Props
	export let collapsed = false;
	export let position: 'left' | 'right' = 'left';
	export let width = 'w-64';
	export let collapsedWidth = 'w-16';
	export let showCollapseButton = true;
	export let activeUrl = '/';
	export let customClass = '';

	// State
	let mounted = false;

	// Theme integration
	$: currentColors = $colors;
	$: dynamicStyles = `
		--sidebar-bg: ${currentColors.surface};
		--sidebar-border: ${currentColors.primary};
		--sidebar-text: ${currentColors.text};
		--sidebar-accent: ${currentColors.primary};
		--sidebar-hover: color-mix(in srgb, ${currentColors.primary} 10%, transparent);
	`;

	// Sidebar items configuration
	const sidebarItems = [
		{
			label: 'Dashboard',
			href: '/',
			icon: HomeIcon,
			active: true,
			badge: null
		},
		{
			label: 'Terminal',
			href: '/terminal',
			icon: TerminalIcon,
			badge: null
		},
		{
			label: 'Projects',
			href: '/projects',
			icon: FolderIcon,
			badge: { text: '12', color: 'blue' },
			children: [
				{ label: 'Active Projects', href: '/projects/active', badge: { text: '8', color: 'green' } },
				{ label: 'Archived', href: '/projects/archived', badge: { text: '4', color: 'gray' } },
				{ label: 'Templates', href: '/projects/templates' }
			]
		},
		{
			label: 'Voice Commands',
			href: '/voice',
			icon: MicrophoneIcon,
			badge: { text: 'New', color: 'red' }
		},
		{
			label: 'Code Snippets',
			href: '/snippets',
			icon: CodeBracketIcon,
			badge: { text: '24', color: 'purple' }
		},
		{
			label: 'Documentation',
			href: '/docs',
			icon: BookOpenIcon,
			children: [
				{ label: 'User Guide', href: '/docs/guide' },
				{ label: 'API Reference', href: '/docs/api' },
				{ label: 'Tutorials', href: '/docs/tutorials' },
				{ label: 'FAQ', href: '/docs/faq' }
			]
		},
		{
			label: 'Analytics',
			href: '/analytics',
			icon: ChartBarIcon,
			badge: null
		},
		{
			label: 'History',
			href: '/history',
			icon: ClockIcon,
			badge: null
		}
	];

	const bottomItems = [
		{
			label: 'Settings',
			href: '/settings',
			icon: CogIcon
		},
		{
			label: 'Cloud Sync',
			href: '/sync',
			icon: CloudIcon,
			badge: { text: '!', color: 'yellow' }
		},
		{
			label: 'Team',
			href: '/team',
			icon: UserGroupIcon
		}
	];

	function handleItemClick(item: any) {
		dispatch('item-click', { item });
	}

	function toggleCollapse() {
		collapsed = !collapsed;
		dispatch('collapse-toggle', { collapsed });
	}

	function isActive(href: string): boolean {
		return activeUrl === href || activeUrl.startsWith(href + '/');
	}

	onMount(() => {
		mounted = true;
	});
</script>

<div 
	class="sidebar-container {collapsed ? collapsedWidth : width} transition-all duration-300 {customClass}"
	style={dynamicStyles}
>
	<Sidebar class="h-full">
		<SidebarWrapper class="h-full flex flex-col">
			<!-- Collapse Button -->
			{#if showCollapseButton}
				<div class="flex justify-end p-2 border-b border-gray-200 dark:border-gray-700">
					<Button
						size="sm"
						color="alternative"
						class="!p-2"
						on:click={toggleCollapse}
					>
						{#if collapsed}
							<ChevronDoubleRightIcon class="w-4 h-4" />
						{:else}
							<ChevronDoubleLeftIcon class="w-4 h-4" />
						{/if}
					</Button>
				</div>
			{/if}

			<!-- Main Navigation -->
			<SidebarGroup class="flex-1 overflow-y-auto">
				{#each sidebarItems as item (item.href)}
					{#if item.children}
						<SidebarDropdownWrapper 
							label={item.label}
							isOpen={!collapsed && isActive(item.href)}
						>
							<svelte:fragment slot="icon">
								<svelte:component this={item.icon} class="w-5 h-5" />
							</svelte:fragment>
							
							{#if item.badge && !collapsed}
								<svelte:fragment slot="arrowup">
									<Badge color={item.badge.color} class="ml-2">
										{item.badge.text}
									</Badge>
								</svelte:fragment>
							{/if}

							{#each item.children as child (child.href)}
								<SidebarDropdownItem 
									href={child.href}
									label={child.label}
									active={isActive(child.href)}
									on:click={() => handleItemClick(child)}
									class="pl-11"
								>
									{#if child.badge && !collapsed}
										<Badge color={child.badge.color} class="ml-auto">
											{child.badge.text}
										</Badge>
									{/if}
								</SidebarDropdownItem>
							{/each}
						</SidebarDropdownWrapper>
					{:else}
						<SidebarItem 
							href={item.href}
							label={collapsed ? '' : item.label}
							active={isActive(item.href)}
							on:click={() => handleItemClick(item)}
							class="group relative"
						>
							<svelte:fragment slot="icon">
								<svelte:component this={item.icon} class="w-5 h-5" />
							</svelte:fragment>
							
							{#if item.badge && !collapsed}
								<Badge color={item.badge.color} class="ml-auto">
									{item.badge.text}
								</Badge>
							{/if}

							<!-- Tooltip for collapsed state -->
							{#if collapsed && mounted}
								<Tooltip 
									placement="right" 
									class="tooltip-sidebar"
									triggeredBy=".group"
								>
									{item.label}
									{#if item.badge}
										<Badge color={item.badge.color} class="ml-2">
											{item.badge.text}
										</Badge>
									{/if}
								</Tooltip>
							{/if}
						</SidebarItem>
					{/if}
				{/each}
			</SidebarGroup>

			<!-- Bottom Navigation -->
			<SidebarGroup class="border-t border-gray-200 dark:border-gray-700 mt-auto">
				{#each bottomItems as item (item.href)}
					<SidebarItem 
						href={item.href}
						label={collapsed ? '' : item.label}
						active={isActive(item.href)}
						on:click={() => handleItemClick(item)}
						class="group relative"
					>
						<svelte:fragment slot="icon">
							<svelte:component this={item.icon} class="w-5 h-5" />
						</svelte:fragment>
						
						{#if item.badge && !collapsed}
							<Badge color={item.badge.color} class="ml-auto">
								{item.badge.text}
							</Badge>
						{/if}

						<!-- Tooltip for collapsed state -->
						{#if collapsed && mounted}
							<Tooltip 
								placement="right" 
								class="tooltip-sidebar"
								triggeredBy=".group"
							>
								{item.label}
								{#if item.badge}
									<Badge color={item.badge.color} class="ml-2">
										{item.badge.text}
									</Badge>
								{/if}
							</Tooltip>
						{/if}
					</SidebarItem>
				{/each}
			</SidebarGroup>
		</SidebarWrapper>
	</Sidebar>
</div>

<style>
	.sidebar-container {
		background: var(--sidebar-bg);
		border-color: var(--sidebar-border);
		color: var(--sidebar-text);
	}

	:global(.sidebar-container .sidebar) {
		background: var(--sidebar-bg);
		border-color: var(--sidebar-border);
		color: var(--sidebar-text);
	}

	:global(.sidebar-container .sidebar-item) {
		color: var(--sidebar-text);
		transition: all 0.2s ease;
	}

	:global(.sidebar-container .sidebar-item:hover) {
		background: var(--sidebar-hover);
		color: var(--sidebar-accent);
	}

	:global(.sidebar-container .sidebar-item.active) {
		background: var(--sidebar-hover);
		color: var(--sidebar-accent);
		font-weight: 600;
		border-right: 3px solid var(--sidebar-accent);
	}

	:global(.sidebar-container .sidebar-dropdown) {
		color: var(--sidebar-text);
	}

	:global(.sidebar-container .sidebar-dropdown:hover) {
		background: var(--sidebar-hover);
		color: var(--sidebar-accent);
	}

	:global(.sidebar-container .sidebar-dropdown-item) {
		color: var(--sidebar-text);
		transition: all 0.2s ease;
	}

	:global(.sidebar-container .sidebar-dropdown-item:hover) {
		background: var(--sidebar-hover);
		color: var(--sidebar-accent);
	}

	:global(.sidebar-container .sidebar-dropdown-item.active) {
		background: var(--sidebar-hover);
		color: var(--sidebar-accent);
		font-weight: 500;
	}

	/* Custom scrollbar */
	:global(.sidebar-container .overflow-y-auto::-webkit-scrollbar) {
		width: 6px;
	}

	:global(.sidebar-container .overflow-y-auto::-webkit-scrollbar-track) {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 3px;
	}

	:global(.sidebar-container .overflow-y-auto::-webkit-scrollbar-thumb) {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 3px;
	}

	:global(.sidebar-container .overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: rgba(0, 0, 0, 0.5);
	}

	/* Dark mode scrollbar */
	:global(.dark .sidebar-container .overflow-y-auto::-webkit-scrollbar-track) {
		background: rgba(255, 255, 255, 0.1);
	}

	:global(.dark .sidebar-container .overflow-y-auto::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.3);
	}

	:global(.dark .sidebar-container .overflow-y-auto::-webkit-scrollbar-thumb:hover) {
		background: rgba(255, 255, 255, 0.5);
	}

	/* Tooltip styling */
	:global(.tooltip-sidebar) {
		z-index: 1000;
		max-width: 200px;
	}

	/* Transition improvements */
	.sidebar-container {
		transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Badge positioning in collapsed state */
	:global(.sidebar-container .sidebar-item .badge) {
		min-width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
	}

	/* Active state indicator */
	:global(.sidebar-container .sidebar-item.active::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--sidebar-accent);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.sidebar-container {
			position: fixed;
			top: 0;
			left: 0;
			height: 100vh;
			z-index: 40;
			transform: translateX(-100%);
		}

		.sidebar-container.open {
			transform: translateX(0);
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		:global(.sidebar-container .sidebar-item) {
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		}

		:global(.sidebar-container .sidebar-item.active) {
			border-left: 4px solid var(--sidebar-accent);
			background: var(--sidebar-accent);
			color: var(--sidebar-bg);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.sidebar-container,
		:global(.sidebar-container .sidebar-item),
		:global(.sidebar-container .sidebar-dropdown-item) {
			transition: none !important;
		}
	}

	/* Focus styles */
	:global(.sidebar-container .sidebar-item:focus-visible) {
		outline: 2px solid var(--sidebar-accent);
		outline-offset: -2px;
	}

	/* Loading state */
	:global(.sidebar-container .sidebar-item.loading) {
		opacity: 0.6;
		pointer-events: none;
	}
</style>