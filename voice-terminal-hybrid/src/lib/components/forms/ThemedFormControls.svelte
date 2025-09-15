<script lang="ts">
	import { 
		Input,
		Label,
		Helper,
		Select,
		Textarea,
		Toggle,
		Checkbox,
		Radio,
		Range,
		Fileupload,
		Search,
		NumberInput,
		ColorPicker,
		Button,
		ButtonGroup
	} from 'flowbite-svelte';
	import { 
		EyeIcon,
		EyeSlashIcon,
		ExclamationCircleIcon,
		CheckCircleIcon,
		InformationCircleIcon
	} from 'flowbite-svelte-icons';
	import { themeStore, colors } from '$lib/stores/theme.js';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Props for form validation and styling
	export let variant: 'default' | 'filled' | 'outlined' | 'underlined' = 'default';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let disabled = false;
	export let readonly = false;
	export let customClass = '';

	// Form state
	let textValue = '';
	let emailValue = '';
	let passwordValue = '';
	let showPassword = false;
	let textareaValue = '';
	let selectValue = '';
	let toggleValue = false;
	let checkboxValue = false;
	let radioValue = '';
	let rangeValue = 50;
	let numberValue = 0;
	let colorValue = '#3B82F6';
	let fileValue = '';
	let searchValue = '';

	// Validation states
	let validationStates: Record<string, {
		valid: boolean;
		message: string;
		type: 'error' | 'warning' | 'success' | 'info';
	}> = {};

	// Theme integration
	$: currentColors = $colors;
	$: dynamicStyles = `
		--form-bg: ${currentColors.background};
		--form-surface: ${currentColors.surface};
		--form-border: color-mix(in srgb, ${currentColors.text} 20%, transparent);
		--form-border-focus: ${currentColors.primary};
		--form-text: ${currentColors.text};
		--form-placeholder: color-mix(in srgb, ${currentColors.text} 60%, transparent);
		--form-label: ${currentColors.text};
		--form-error: ${currentColors.error};
		--form-success: ${currentColors.success};
		--form-warning: ${currentColors.warning};
		--form-info: ${currentColors.primary};
	`;

	// Size classes
	$: sizeClasses = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg'
	}[size];

	// Variant classes
	$: variantClasses = {
		default: 'border-gray-300 dark:border-gray-600',
		filled: 'bg-gray-50 dark:bg-gray-700 border-transparent',
		outlined: 'border-2 border-gray-300 dark:border-gray-600 bg-transparent',
		underlined: 'border-0 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent rounded-none'
	}[variant];

	// Select options
	const selectOptions = [
		{ value: '', text: 'Choose an option' },
		{ value: 'option1', text: 'Option 1' },
		{ value: 'option2', text: 'Option 2' },
		{ value: 'option3', text: 'Option 3' }
	];

	// Radio options
	const radioOptions = [
		{ value: 'radio1', text: 'Radio Option 1' },
		{ value: 'radio2', text: 'Radio Option 2' },
		{ value: 'radio3', text: 'Radio Option 3' }
	];

	function validateField(fieldName: string, value: any, rules: any = {}) {
		const validation = { valid: true, message: '', type: 'success' as const };

		switch (fieldName) {
			case 'email':
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!emailRegex.test(value)) {
					validation.valid = false;
					validation.message = 'Please enter a valid email address';
					validation.type = 'error';
				}
				break;

			case 'password':
				if (value.length < 8) {
					validation.valid = false;
					validation.message = 'Password must be at least 8 characters long';
					validation.type = 'error';
				} else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
					validation.valid = false;
					validation.message = 'Password must contain uppercase, lowercase, and number';
					validation.type = 'warning';
				}
				break;

			case 'required':
				if (!value || value.trim() === '') {
					validation.valid = false;
					validation.message = 'This field is required';
					validation.type = 'error';
				}
				break;
		}

		validationStates[fieldName] = validation;
		validationStates = { ...validationStates };

		dispatch('validation', { field: fieldName, validation });
		return validation;
	}

	function handleInput(event: Event, fieldName: string) {
		const target = event.target as HTMLInputElement;
		dispatch('input', { field: fieldName, value: target.value });
	}

	function handleChange(event: Event, fieldName: string) {
		const target = event.target as HTMLInputElement;
		validateField(fieldName, target.value);
		dispatch('change', { field: fieldName, value: target.value });
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function getValidationIcon(fieldName: string) {
		const state = validationStates[fieldName];
		if (!state) return null;

		switch (state.type) {
			case 'error':
				return ExclamationCircleIcon;
			case 'success':
				return CheckCircleIcon;
			case 'info':
			case 'warning':
				return InformationCircleIcon;
			default:
				return null;
		}
	}

	function getValidationColor(fieldName: string) {
		const state = validationStates[fieldName];
		if (!state) return 'gray';

		switch (state.type) {
			case 'error':
				return 'red';
			case 'success':
				return 'green';
			case 'warning':
				return 'yellow';
			case 'info':
				return 'blue';
			default:
				return 'gray';
		}
	}
</script>

<div class="themed-form-controls {customClass}" style={dynamicStyles}>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Text Input -->
		<div class="form-group">
			<Label for="text-input" class="mb-2">
				Text Input
				<span class="text-red-500">*</span>
			</Label>
			<Input
				id="text-input"
				bind:value={textValue}
				placeholder="Enter text..."
				{disabled}
				{readonly}
				class="{sizeClasses} {variantClasses}"
				on:input={(e) => handleInput(e, 'text')}
				on:blur={(e) => handleChange(e, 'required')}
			/>
			{#if validationStates.required}
				<Helper class="mt-2" color={getValidationColor('required')}>
					<svelte:component this={getValidationIcon('required')} class="w-4 h-4 mr-1 inline" />
					{validationStates.required.message}
				</Helper>
			{/if}
		</div>

		<!-- Email Input -->
		<div class="form-group">
			<Label for="email-input" class="mb-2">Email Address</Label>
			<Input
				id="email-input"
				type="email"
				bind:value={emailValue}
				placeholder="user@example.com"
				{disabled}
				{readonly}
				class="{sizeClasses} {variantClasses}"
				on:input={(e) => handleInput(e, 'email')}
				on:blur={(e) => handleChange(e, 'email')}
			/>
			{#if validationStates.email}
				<Helper class="mt-2" color={getValidationColor('email')}>
					<svelte:component this={getValidationIcon('email')} class="w-4 h-4 mr-1 inline" />
					{validationStates.email.message}
				</Helper>
			{/if}
		</div>

		<!-- Password Input -->
		<div class="form-group">
			<Label for="password-input" class="mb-2">Password</Label>
			<div class="relative">
				<Input
					id="password-input"
					type={showPassword ? 'text' : 'password'}
					bind:value={passwordValue}
					placeholder="Enter password..."
					{disabled}
					{readonly}
					class="{sizeClasses} {variantClasses} pr-10"
					on:input={(e) => handleInput(e, 'password')}
					on:blur={(e) => handleChange(e, 'password')}
				/>
				<button
					type="button"
					class="absolute inset-y-0 right-0 flex items-center pr-3"
					on:click={togglePasswordVisibility}
					disabled={disabled || readonly}
				>
					{#if showPassword}
						<EyeSlashIcon class="w-4 h-4 text-gray-400" />
					{:else}
						<EyeIcon class="w-4 h-4 text-gray-400" />
					{/if}
				</button>
			</div>
			{#if validationStates.password}
				<Helper class="mt-2" color={getValidationColor('password')}>
					<svelte:component this={getValidationIcon('password')} class="w-4 h-4 mr-1 inline" />
					{validationStates.password.message}
				</Helper>
			{/if}
		</div>

		<!-- Search Input -->
		<div class="form-group">
			<Label for="search-input" class="mb-2">Search</Label>
			<Search
				id="search-input"
				bind:value={searchValue}
				placeholder="Search..."
				{disabled}
				class="{sizeClasses}"
			/>
		</div>

		<!-- Number Input -->
		<div class="form-group">
			<Label for="number-input" class="mb-2">Number Input</Label>
			<NumberInput
				id="number-input"
				bind:value={numberValue}
				min="0"
				max="100"
				{disabled}
				{readonly}
				class="{sizeClasses} {variantClasses}"
			/>
		</div>

		<!-- Color Picker -->
		<div class="form-group">
			<Label for="color-input" class="mb-2">Color Picker</Label>
			<div class="flex items-center gap-2">
				<Input
					id="color-input"
					type="color"
					bind:value={colorValue}
					{disabled}
					{readonly}
					class="w-12 h-10 !p-1 rounded border"
				/>
				<Input
					type="text"
					bind:value={colorValue}
					placeholder="#000000"
					{disabled}
					{readonly}
					class="flex-1 {sizeClasses} {variantClasses} font-mono"
				/>
			</div>
		</div>
	</div>

	<!-- Textarea -->
	<div class="form-group mt-6">
		<Label for="textarea-input" class="mb-2">Text Area</Label>
		<Textarea
			id="textarea-input"
			bind:value={textareaValue}
			placeholder="Enter longer text..."
			rows="4"
			{disabled}
			{readonly}
			class="{sizeClasses} {variantClasses}"
		/>
	</div>

	<!-- Select -->
	<div class="form-group mt-6">
		<Label for="select-input" class="mb-2">Select Dropdown</Label>
		<Select
			id="select-input"
			bind:value={selectValue}
			{disabled}
			class="{sizeClasses} {variantClasses}"
		>
			{#each selectOptions as option (option.value)}
				<option value={option.value}>{option.text}</option>
			{/each}
		</Select>
	</div>

	<!-- Range Slider -->
	<div class="form-group mt-6">
		<Label for="range-input" class="mb-2">
			Range Slider: {rangeValue}
		</Label>
		<Range
			id="range-input"
			bind:value={rangeValue}
			min="0"
			max="100"
			{disabled}
			class="w-full"
		/>
	</div>

	<!-- File Upload -->
	<div class="form-group mt-6">
		<Label for="file-input" class="mb-2">File Upload</Label>
		<Fileupload
			id="file-input"
			bind:value={fileValue}
			{disabled}
			class="{variantClasses}"
		/>
	</div>

	<!-- Toggle and Checkboxes -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
		<!-- Toggle -->
		<div class="form-group">
			<Label class="mb-4 block">Toggle Switch</Label>
			<Toggle
				bind:checked={toggleValue}
				{disabled}
				on:change={(e) => dispatch('change', { field: 'toggle', value: e.detail })}
			>
				Enable feature
			</Toggle>
		</div>

		<!-- Checkbox -->
		<div class="form-group">
			<Label class="mb-4 block">Checkbox</Label>
			<Checkbox
				bind:checked={checkboxValue}
				{disabled}
				on:change={(e) => dispatch('change', { field: 'checkbox', value: e.detail })}
			>
				I agree to the terms
			</Checkbox>
		</div>
	</div>

	<!-- Radio Buttons -->
	<div class="form-group mt-6">
		<Label class="mb-4 block">Radio Buttons</Label>
		<div class="flex flex-col gap-2">
			{#each radioOptions as option (option.value)}
				<Radio
					bind:group={radioValue}
					value={option.value}
					{disabled}
					on:change={(e) => dispatch('change', { field: 'radio', value: e.detail })}
				>
					{option.text}
				</Radio>
			{/each}
		</div>
	</div>

	<!-- Form Actions -->
	<div class="form-actions mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
		<ButtonGroup class="w-full md:w-auto">
			<Button
				color="primary"
				{disabled}
				on:click={() => dispatch('submit')}
			>
				Submit
			</Button>
			<Button
				color="alternative"
				{disabled}
				on:click={() => dispatch('reset')}
			>
				Reset
			</Button>
			<Button
				color="light"
				{disabled}
				on:click={() => dispatch('cancel')}
			>
				Cancel
			</Button>
		</ButtonGroup>
	</div>
</div>

<style>
	.themed-form-controls {
		background: var(--form-bg);
		color: var(--form-text);
	}

	/* Input styling */
	:global(.themed-form-controls input) {
		background: var(--form-surface);
		color: var(--form-text);
		border-color: var(--form-border);
		transition: all 0.2s ease;
	}

	:global(.themed-form-controls input:focus) {
		border-color: var(--form-border-focus);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--form-border-focus) 20%, transparent);
	}

	:global(.themed-form-controls input::placeholder) {
		color: var(--form-placeholder);
	}

	/* Textarea styling */
	:global(.themed-form-controls textarea) {
		background: var(--form-surface);
		color: var(--form-text);
		border-color: var(--form-border);
		transition: all 0.2s ease;
	}

	:global(.themed-form-controls textarea:focus) {
		border-color: var(--form-border-focus);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--form-border-focus) 20%, transparent);
	}

	:global(.themed-form-controls textarea::placeholder) {
		color: var(--form-placeholder);
	}

	/* Select styling */
	:global(.themed-form-controls select) {
		background: var(--form-surface);
		color: var(--form-text);
		border-color: var(--form-border);
		transition: all 0.2s ease;
	}

	:global(.themed-form-controls select:focus) {
		border-color: var(--form-border-focus);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--form-border-focus) 20%, transparent);
	}

	/* Label styling */
	:global(.themed-form-controls label) {
		color: var(--form-label);
		font-weight: 500;
	}

	/* Range slider styling */
	:global(.themed-form-controls input[type="range"]) {
		background: var(--form-border);
	}

	:global(.themed-form-controls input[type="range"]::-webkit-slider-thumb) {
		background: var(--form-border-focus);
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}

	:global(.themed-form-controls input[type="range"]::-moz-range-thumb) {
		background: var(--form-border-focus);
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}

	/* Toggle and checkbox styling */
	:global(.themed-form-controls .toggle input:checked) {
		background-color: var(--form-border-focus);
		border-color: var(--form-border-focus);
	}

	:global(.themed-form-controls .checkbox input:checked) {
		background-color: var(--form-border-focus);
		border-color: var(--form-border-focus);
	}

	:global(.themed-form-controls .radio input:checked) {
		background-color: var(--form-border-focus);
		border-color: var(--form-border-focus);
	}

	/* File upload styling */
	:global(.themed-form-controls .fileupload) {
		background: var(--form-surface);
		border-color: var(--form-border);
		color: var(--form-text);
	}

	/* Disabled state */
	:global(.themed-form-controls input:disabled),
	:global(.themed-form-controls textarea:disabled),
	:global(.themed-form-controls select:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
		background: color-mix(in srgb, var(--form-surface) 80%, var(--form-border));
	}

	/* Password toggle button */
	.themed-form-controls .relative button {
		color: var(--form-placeholder);
		transition: color 0.2s ease;
	}

	.themed-form-controls .relative button:hover:not(:disabled) {
		color: var(--form-text);
	}

	/* Color input styling */
	:global(.themed-form-controls input[type="color"]) {
		cursor: pointer;
		border: 1px solid var(--form-border);
		border-radius: 0.375rem;
	}

	:global(.themed-form-controls input[type="color"]::-webkit-color-swatch-wrapper) {
		padding: 0;
		border-radius: 0.25rem;
	}

	:global(.themed-form-controls input[type="color"]::-webkit-color-swatch) {
		border: none;
		border-radius: 0.25rem;
	}

	/* Helper text styling */
	:global(.themed-form-controls .helper-text) {
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	/* Validation states */
	:global(.themed-form-controls .helper-text.text-red-600) {
		color: var(--form-error);
	}

	:global(.themed-form-controls .helper-text.text-green-600) {
		color: var(--form-success);
	}

	:global(.themed-form-controls .helper-text.text-yellow-600) {
		color: var(--form-warning);
	}

	:global(.themed-form-controls .helper-text.text-blue-600) {
		color: var(--form-info);
	}

	/* Focus styles for accessibility */
	:global(.themed-form-controls input:focus-visible),
	:global(.themed-form-controls textarea:focus-visible),
	:global(.themed-form-controls select:focus-visible) {
		outline: 2px solid var(--form-border-focus);
		outline-offset: 2px;
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		:global(.themed-form-controls input),
		:global(.themed-form-controls textarea),
		:global(.themed-form-controls select) {
			border-width: 2px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		:global(.themed-form-controls input),
		:global(.themed-form-controls textarea),
		:global(.themed-form-controls select) {
			transition: none !important;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.form-actions {
			text-align: center;
		}

		:global(.themed-form-controls .button-group) {
			flex-direction: column;
			width: 100%;
		}

		:global(.themed-form-controls .button-group .button) {
			width: 100%;
			margin-bottom: 0.5rem;
		}
	}
</style>