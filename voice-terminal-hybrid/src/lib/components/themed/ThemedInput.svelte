<script>
  import { Input, Label, Helper } from 'flowbite-svelte';
  import { currentColors } from '$lib/stores/theme.js';
  
  export let id = '';
  export let name = '';
  export let value = '';
  export let type = 'text';
  export let placeholder = '';
  export let disabled = false;
  export let readonly = false;
  export let required = false;
  export let size = 'md';
  export let label = '';
  export let helper = '';
  export let error = '';
  
  // Custom theme props
  export let customClass = '';
  export let customStyle = '';
  export let variant = 'default';
  
  $: colors = $currentColors;
  
  // Generate theme styles
  $: themeStyles = `
    --input-bg: ${colors.surface};
    --input-border: ${colors.border};
    --input-border-focus: ${colors.outline};
    --input-text: ${colors.text};
    --input-placeholder: ${colors.textMuted};
    --input-error-border: ${colors.error};
    --input-success-border: ${colors.success};
    --input-border-radius: var(--border-radius-md);
    --input-padding: var(--spacing-3);
    --input-font-size: var(--font-size-base);
    --input-transition: var(--transition-fast);
    ${customStyle}
  `;
  
  // Size variants
  $: sizeClass = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-3'
  }[size] || 'text-base px-3 py-2';
  
  // Variant classes
  $: variantClass = {
    default: '',
    terminal: 'font-mono bg-black text-green-400 border-green-500',
    accent: 'border-accent focus:border-accent'
  }[variant] || '';
  
  $: combinedClass = `
    themed-input
    theme-transition
    ${sizeClass}
    ${variantClass}
    ${error ? 'error' : ''}
    ${customClass}
  `.trim();
  
  $: inputId = id || `input-${Math.random().toString(36).slice(2)}`;
</script>

{#if label}
  <div class="themed-input-group">
    <Label for={inputId} class="themed-label theme-transition">{label}</Label>
    
    <Input
      {id}
      {name}
      bind:value
      {type}
      {placeholder}
      {disabled}
      {readonly}
      {required}
      class={combinedClass}
      style={themeStyles}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
      on:keyup
      on:keypress
    />
    
    {#if helper || error}
      <Helper class="themed-helper theme-transition {error ? 'error' : ''}">
        {error || helper}
      </Helper>
    {/if}
  </div>
{:else}
  <Input
    {id}
    {name}
    bind:value
    {type}
    {placeholder}
    {disabled}
    {readonly}
    {required}
    class={combinedClass}
    style={themeStyles}
    on:input
    on:change
    on:focus
    on:blur
    on:keydown
    on:keyup
    on:keypress
  />
{/if}

<style>
  :global(.themed-input-group) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  
  :global(.themed-input) {
    background-color: var(--input-bg) !important;
    border-color: var(--input-border) !important;
    color: var(--input-text) !important;
    border-radius: var(--input-border-radius) !important;
    font-size: var(--input-font-size) !important;
    transition: var(--input-transition) !important;
    font-family: var(--font-family) !important;
  }
  
  :global(.themed-input::placeholder) {
    color: var(--input-placeholder) !important;
    opacity: 0.8;
  }
  
  :global(.themed-input:focus) {
    border-color: var(--input-border-focus) !important;
    box-shadow: 0 0 0 1px var(--input-border-focus) !important;
    outline: none !important;
  }
  
  :global(.themed-input:focus-visible) {
    outline: 2px solid var(--color-outline) !important;
    outline-offset: 2px !important;
  }
  
  :global(.themed-input.error) {
    border-color: var(--input-error-border) !important;
  }
  
  :global(.themed-input.error:focus) {
    border-color: var(--input-error-border) !important;
    box-shadow: 0 0 0 1px var(--input-error-border) !important;
  }
  
  :global(.themed-input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--color-surface-secondary) !important;
  }
  
  :global(.themed-input:readonly) {
    background-color: var(--color-surface-secondary) !important;
    cursor: default;
  }
  
  /* Label styling */
  :global(.themed-label) {
    color: var(--color-text) !important;
    font-weight: var(--font-weight-medium) !important;
    font-size: var(--font-size-sm) !important;
  }
  
  /* Helper text styling */
  :global(.themed-helper) {
    color: var(--color-text-muted) !important;
    font-size: var(--font-size-xs) !important;
  }
  
  :global(.themed-helper.error) {
    color: var(--color-error) !important;
  }
  
  /* Terminal variant */
  :global(.themed-input[data-variant="terminal"]) {
    font-family: var(--font-family-mono) !important;
    background-color: #000000 !important;
    color: var(--color-accent) !important;
    border-color: var(--color-accent) !important;
  }
  
  :global(.themed-input[data-variant="terminal"]:focus) {
    box-shadow: 0 0 10px color-mix(in srgb, var(--color-accent) 30%, transparent) !important;
  }
  
  :global(.themed-input[data-variant="terminal"]::placeholder) {
    color: color-mix(in srgb, var(--color-accent) 60%, transparent) !important;
  }
  
  /* Accent variant */
  :global(.themed-input[data-variant="accent"]) {
    border-color: var(--color-accent) !important;
  }
  
  :global(.themed-input[data-variant="accent"]:focus) {
    border-color: var(--color-accent) !important;
    box-shadow: 0 0 0 1px var(--color-accent), 0 0 10px color-mix(in srgb, var(--color-accent) 20%, transparent) !important;
  }
  
  /* Size variants */
  :global(.themed-input.sm) {
    padding: var(--spacing-2) !important;
    font-size: var(--font-size-sm) !important;
  }
  
  :global(.themed-input.lg) {
    padding: var(--spacing-4) !important;
    font-size: var(--font-size-lg) !important;
  }
  
  /* Dark mode adjustments */
  :global([data-theme="dark"] .themed-input) {
    background-color: var(--color-surface) !important;
    border-color: var(--color-border) !important;
    color: var(--color-text) !important;
  }
  
  /* Light mode adjustments */
  :global([data-theme="light"] .themed-input) {
    background-color: var(--color-background) !important;
    border-color: var(--color-border) !important;
    color: var(--color-text) !important;
  }
  
  /* High contrast mode */
  :global([data-theme-preset="high-contrast"] .themed-input) {
    border-width: 2px !important;
    font-weight: var(--font-weight-semibold) !important;
  }
  
  :global([data-theme-preset="high-contrast"] .themed-input:focus) {
    border-width: 3px !important;
  }
</style>