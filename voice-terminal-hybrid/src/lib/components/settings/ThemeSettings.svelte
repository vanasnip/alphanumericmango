<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		Card, 
		Label, 
		Select, 
		Range, 
		Input, 
		Button, 
		ButtonGroup,
		Badge,
		Alert,
		Accordion,
		AccordionItem,
		Toggle,
		ColorPicker
	} from 'flowbite-svelte';
	import { 
		PaletteIcon, 
		SunIcon, 
		MoonIcon, 
		ComputerDesktopIcon,
		CheckCircleIcon,
		ExclamationTriangleIcon,
		ArrowPathIcon
	} from 'flowbite-svelte-icons';
	import { themeStore, themeError, colors } from '$lib/stores/theme.js';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Theme state
	let currentTheme = $themeStore;
	let currentError = $themeError;
	let isDirty = false;
	let isLoading = false;
	let savedSuccessfully = false;

	// Form fields
	let selectedMode = currentTheme.mode;
	let selectedPreset = currentTheme.preset;
	let themeColors = { ...currentTheme.global.colors };
	let typography = { ...currentTheme.global.typography };
	let spacing = { ...currentTheme.global.spacing };
	let borders = { ...currentTheme.global.borders };

	// Available options
	const modeOptions = [
		{ value: 'light', name: 'Light Mode', icon: SunIcon },
		{ value: 'dark', name: 'Dark Mode', icon: MoonIcon },
		{ value: 'auto', name: 'Auto Mode', icon: ComputerDesktopIcon }
	];

	const presetOptions = [
		{ value: 'default', name: 'Default' },
		{ value: 'ocean', name: 'Ocean' },
		{ value: 'forest', name: 'Forest' },
		{ value: 'custom', name: 'Custom' }
	];

	// Color keys for editor
	const colorKeys = [
		{ key: 'primary', label: 'Primary', description: 'Main brand color' },
		{ key: 'secondary', label: 'Secondary', description: 'Secondary accent color' },
		{ key: 'success', label: 'Success', description: 'Success state color' },
		{ key: 'warning', label: 'Warning', description: 'Warning state color' },
		{ key: 'error', label: 'Error', description: 'Error state color' },
		{ key: 'background', label: 'Background', description: 'Main background color' },
		{ key: 'surface', label: 'Surface', description: 'Card and panel background' },
		{ key: 'text', label: 'Text', description: 'Primary text color' }
	];

	// Font options
	const fontFamilyOptions = [
		{ value: 'Inter, system-ui', name: 'Inter (Default)' },
		{ value: 'Roboto, sans-serif', name: 'Roboto' },
		{ value: 'Open Sans, sans-serif', name: 'Open Sans' },
		{ value: 'Poppins, sans-serif', name: 'Poppins' },
		{ value: 'system-ui, sans-serif', name: 'System UI' }
	];

	// Border radius options
	const borderRadiusPresets = [
		{ name: 'None', values: { none: '0', sm: '0', md: '0', lg: '0', full: '0' } },
		{ name: 'Minimal', values: { none: '0', sm: '2px', md: '4px', lg: '6px', full: '9999px' } },
		{ name: 'Default', values: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' } },
		{ name: 'Rounded', values: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', full: '9999px' } },
		{ name: 'Extra Rounded', values: { none: '0', sm: '0.5rem', md: '1rem', lg: '1.5rem', full: '9999px' } }
	];

	// Reactive subscriptions
	$: currentTheme = $themeStore;
	$: currentError = $themeError;
	$: currentColors = $colors;

	// Watch for changes to determine if dirty
	$: {
		isDirty = (
			selectedMode !== currentTheme.mode ||
			selectedPreset !== currentTheme.preset ||
			JSON.stringify(themeColors) !== JSON.stringify(currentTheme.global.colors) ||
			JSON.stringify(typography) !== JSON.stringify(currentTheme.global.typography) ||
			JSON.stringify(spacing) !== JSON.stringify(currentTheme.global.spacing) ||
			JSON.stringify(borders) !== JSON.stringify(currentTheme.global.borders)
		);
	}

	// Reset form when theme changes externally
	$: {
		if (!isDirty) {
			selectedMode = currentTheme.mode;
			selectedPreset = currentTheme.preset;
			themeColors = { ...currentTheme.global.colors };
			typography = { ...currentTheme.global.typography };
			spacing = { ...currentTheme.global.spacing };
			borders = { ...currentTheme.global.borders };
		}
	}

	function handleModeChange(mode: string) {
		selectedMode = mode;
		applyChanges();
	}

	function handlePresetChange(preset: string) {
		selectedPreset = preset;
		if (preset !== 'custom') {
			themeStore.applyPreset(preset);
		}
	}

	function handleColorChange(colorKey: string, value: string) {
		themeColors[colorKey] = value;
		applyChanges();
	}

	function handleTypographyChange() {
		applyChanges();
	}

	function handleSpacingChange() {
		applyChanges();
	}

	function handleBorderRadiusPreset(preset: typeof borderRadiusPresets[0]) {
		borders.radius = { ...preset.values };
		applyChanges();
	}

	async function applyChanges() {
		if (isLoading) return;
		
		isLoading = true;
		savedSuccessfully = false;

		try {
			const updatedTheme = {
				mode: selectedMode,
				preset: selectedPreset,
				global: {
					colors: { ...themeColors },
					typography: { ...typography },
					spacing: { ...spacing },
					borders: { ...borders }
				}
			};

			themeStore.update(current => ({
				...current,
				...updatedTheme
			}));

			savedSuccessfully = true;
			setTimeout(() => savedSuccessfully = false, 3000);
			
			dispatch('change', { theme: updatedTheme });
		} catch (error) {
			console.error('Failed to apply theme changes:', error);
		} finally {
			isLoading = false;
		}
	}

	function resetToDefaults() {
		themeStore.reset();
		dispatch('reset');
	}

	function exportTheme() {
		const exported = themeStore.export();
		const blob = new Blob([exported], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		
		const link = document.createElement('a');
		link.href = url;
		link.download = `theme-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		
		dispatch('export');
	}

	async function importTheme(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		
		if (!file) return;
		
		try {
			const text = await file.text();
			const success = themeStore.import(text);
			
			if (success) {
				dispatch('import', { success: true });
			} else {
				dispatch('import', { success: false, error: $themeError });
			}
		} catch (error) {
			dispatch('import', { success: false, error: error.message });
		}
		
		// Clear input
		input.value = '';
	}

	onMount(() => {
		// Load initial theme state
		selectedMode = currentTheme.mode;
		selectedPreset = currentTheme.preset;
		themeColors = { ...currentTheme.global.colors };
		typography = { ...currentTheme.global.typography };
		spacing = { ...currentTheme.global.spacing };
		borders = { ...currentTheme.global.borders };
	});
</script>

<div class="theme-settings-container space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<PaletteIcon class="w-6 h-6 text-primary-600" />
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
				Theme Settings
			</h2>
			{#if isDirty}
				<Badge color="yellow" class="text-xs">Unsaved Changes</Badge>
			{/if}
			{#if savedSuccessfully}
				<Badge color="green" class="text-xs">
					<CheckCircleIcon class="w-3 h-3 mr-1" />
					Saved
				</Badge>
			{/if}
		</div>
		
		<div class="flex items-center gap-2">
			<Button
				size="sm"
				color="alternative"
				on:click={exportTheme}
				class="!p-2"
			>
				Export
			</Button>
			<Button
				size="sm"
				color="alternative"
				on:click={() => document.getElementById('import-theme').click()}
				class="!p-2"
			>
				Import
			</Button>
			<Button
				size="sm"
				color="alternative"
				on:click={resetToDefaults}
				class="!p-2"
			>
				<ArrowPathIcon class="w-4 h-4" />
			</Button>
		</div>
	</div>

	<!-- Error Alert -->
	{#if currentError}
		<Alert color="red" dismissable>
			<ExclamationTriangleIcon slot="icon" class="w-4 h-4" />
			<span class="font-medium">Theme Error:</span>
			<div class="mt-2 text-sm whitespace-pre-wrap">{currentError}</div>
		</Alert>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Basic Settings -->
		<Card class="p-6">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
				Basic Settings
			</h3>
			
			<div class="space-y-4">
				<!-- Mode Selection -->
				<div>
					<Label for="theme-mode" class="mb-2 block">Theme Mode</Label>
					<ButtonGroup class="w-full">
						{#each modeOptions as mode (mode.value)}
							<Button
								color={selectedMode === mode.value ? 'primary' : 'alternative'}
								class="flex-1"
								on:click={() => handleModeChange(mode.value)}
							>
								<svelte:component this={mode.icon} class="w-4 h-4 mr-2" />
								{mode.name}
							</Button>
						{/each}
					</ButtonGroup>
				</div>

				<!-- Preset Selection -->
				<div>
					<Label for="theme-preset" class="mb-2 block">Theme Preset</Label>
					<Select
						id="theme-preset"
						bind:value={selectedPreset}
						on:change={() => handlePresetChange(selectedPreset)}
						class="w-full"
					>
						{#each presetOptions as preset (preset.value)}
							<option value={preset.value}>{preset.name}</option>
						{/each}
					</Select>
				</div>

				<!-- Typography -->
				<div>
					<Label for="font-family" class="mb-2 block">Font Family</Label>
					<Select
						id="font-family"
						bind:value={typography.fontFamily}
						on:change={handleTypographyChange}
						class="w-full"
					>
						{#each fontFamilyOptions as font (font.value)}
							<option value={font.value}>{font.name}</option>
						{/each}
					</Select>
				</div>

				<!-- Font Size -->
				<div>
					<Label for="font-size" class="mb-2 block">
						Base Font Size: {typography.fontSize.base}
					</Label>
					<Range
						id="font-size"
						min="12"
						max="20"
						bind:value={typography.fontSize.base}
						on:input={handleTypographyChange}
						class="w-full"
					/>
				</div>

				<!-- Font Scale -->
				<div>
					<Label for="font-scale" class="mb-2 block">
						Font Scale: {typography.fontSize.scale}
					</Label>
					<Range
						id="font-scale"
						min="1.1"
						max="1.5"
						step="0.05"
						bind:value={typography.fontSize.scale}
						on:input={handleTypographyChange}
						class="w-full"
					/>
				</div>
			</div>
		</Card>

		<!-- Color Settings -->
		<Card class="p-6">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
				Color Palette
			</h3>
			
			<div class="grid grid-cols-2 gap-4">
				{#each colorKeys as colorConfig (colorConfig.key)}
					<div>
						<Label for="color-{colorConfig.key}" class="mb-2 block text-sm">
							{colorConfig.label}
						</Label>
						<div class="flex items-center gap-2">
							<Input
								id="color-{colorConfig.key}"
								type="color"
								bind:value={themeColors[colorConfig.key]}
								on:input={() => handleColorChange(colorConfig.key, themeColors[colorConfig.key])}
								class="w-12 h-8 !p-1 rounded border"
							/>
							<Input
								type="text"
								bind:value={themeColors[colorConfig.key]}
								on:input={() => handleColorChange(colorConfig.key, themeColors[colorConfig.key])}
								class="flex-1 text-xs font-mono"
								placeholder="#000000"
							/>
						</div>
						<p class="text-xs text-gray-500 mt-1">{colorConfig.description}</p>
					</div>
				{/each}
			</div>
		</Card>
	</div>

	<!-- Advanced Settings -->
	<Card class="p-6">
		<Accordion class="space-y-3">
			<!-- Spacing Settings -->
			<AccordionItem>
				<span slot="header" class="text-base font-medium">Spacing & Layout</span>
				<div class="space-y-4">
					<div>
						<Label for="spacing-unit" class="mb-2 block">
							Spacing Unit: {spacing.unit}
						</Label>
						<Select
							id="spacing-unit"
							bind:value={spacing.unit}
							on:change={handleSpacingChange}
							class="w-full"
						>
							<option value="0.25rem">0.25rem (4px)</option>
							<option value="0.5rem">0.5rem (8px)</option>
							<option value="1rem">1rem (16px)</option>
						</Select>
					</div>
				</div>
			</AccordionItem>

			<!-- Border Settings -->
			<AccordionItem>
				<span slot="header" class="text-base font-medium">Borders & Radius</span>
				<div class="space-y-4">
					<div>
						<Label class="mb-3 block">Border Radius Presets</Label>
						<div class="grid grid-cols-2 lg:grid-cols-5 gap-2">
							{#each borderRadiusPresets as preset (preset.name)}
								<Button
									size="sm"
									color="alternative"
									class="text-xs"
									on:click={() => handleBorderRadiusPreset(preset)}
								>
									{preset.name}
								</Button>
							{/each}
						</div>
					</div>
					
					<div class="grid grid-cols-2 gap-4">
						<div>
							<Label for="border-sm" class="mb-2 block text-sm">Small</Label>
							<Input
								id="border-sm"
								bind:value={borders.radius.sm}
								on:input={handleSpacingChange}
								class="text-xs font-mono"
								placeholder="0.125rem"
							/>
						</div>
						<div>
							<Label for="border-md" class="mb-2 block text-sm">Medium</Label>
							<Input
								id="border-md"
								bind:value={borders.radius.md}
								on:input={handleSpacingChange}
								class="text-xs font-mono"
								placeholder="0.375rem"
							/>
						</div>
						<div>
							<Label for="border-lg" class="mb-2 block text-sm">Large</Label>
							<Input
								id="border-lg"
								bind:value={borders.radius.lg}
								on:input={handleSpacingChange}
								class="text-xs font-mono"
								placeholder="0.5rem"
							/>
						</div>
						<div>
							<Label for="border-full" class="mb-2 block text-sm">Full</Label>
							<Input
								id="border-full"
								bind:value={borders.radius.full}
								on:input={handleSpacingChange}
								class="text-xs font-mono"
								placeholder="9999px"
							/>
						</div>
					</div>
				</div>
			</AccordionItem>
		</Accordion>
	</Card>

	<!-- Hidden file input for import -->
	<input
		id="import-theme"
		type="file"
		accept=".json"
		class="hidden"
		on:change={importTheme}
	/>
</div>

<style>
	:global(.theme-settings-container .accordion-header) {
		padding: 1rem;
	}
	
	:global(.theme-settings-container .accordion-content) {
		padding: 1rem;
	}

	/* Custom color input styling */
	:global(input[type="color"]) {
		cursor: pointer;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
	}

	:global(input[type="color"]::-webkit-color-swatch-wrapper) {
		padding: 0;
		border-radius: 0.25rem;
	}

	:global(input[type="color"]::-webkit-color-swatch) {
		border: none;
		border-radius: 0.25rem;
	}
</style>