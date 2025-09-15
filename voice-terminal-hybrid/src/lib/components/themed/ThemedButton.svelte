<script>
  import { Button } from 'flowbite-svelte';
  import { themeStore, currentColors } from '$lib/stores/theme.js';
  
  export let variant = 'primary';
  export let size = 'md';
  export let disabled = false;
  export let loading = false;
  export let href = null;
  export let type = 'button';
  export let pill = false;
  export let outline = false;
  
  // Custom theme props
  export let customClass = '';
  export let customStyle = '';
  
  $: colors = $currentColors;
  
  // Map variants to Flowbite colors with theme awareness
  $: variantMap = {
    primary: 'blue',
    secondary: 'purple', 
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'cyan',
    accent: 'lime'
  };
  
  $: flowbiteColor = variantMap[variant] || 'blue';
  
  // Generate custom styles based on theme
  $: themeStyles = `
    --btn-primary-bg: ${colors.primary};
    --btn-primary-hover: color-mix(in srgb, ${colors.primary} 90%, black);
    --btn-primary-text: ${colors.textInverse};
    --btn-secondary-bg: ${colors.secondary};
    --btn-secondary-hover: color-mix(in srgb, ${colors.secondary} 90%, black);
    --btn-secondary-text: ${colors.textInverse};
    --btn-success-bg: ${colors.success};
    --btn-success-hover: color-mix(in srgb, ${colors.success} 90%, black);
    --btn-error-bg: ${colors.error};
    --btn-error-hover: color-mix(in srgb, ${colors.error} 90%, black);
    --btn-warning-bg: ${colors.warning};
    --btn-warning-hover: color-mix(in srgb, ${colors.warning} 90%, black);
    --btn-info-bg: ${colors.info};
    --btn-info-hover: color-mix(in srgb, ${colors.info} 90%, black);
    --btn-accent-bg: ${colors.accent};
    --btn-accent-hover: color-mix(in srgb, ${colors.accent} 90%, black);
    --btn-accent-text: ${colors.background};
    --btn-border-radius: var(--border-radius-md);
    --btn-font-weight: var(--font-weight-medium);
    --btn-transition: var(--transition-fast);
    ${customStyle}
  `;
  
  // Size variants
  $: sizeClass = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm', 
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-lg',
    xl: 'px-6 py-3 text-xl'
  }[size] || 'px-4 py-2 text-base';
  
  $: combinedClass = `
    themed-button
    theme-transition
    ${sizeClass}
    ${customClass}
  `.trim();
</script>

<Button
  color={flowbiteColor}
  {disabled}
  {href}
  {type}
  {pill}
  {outline}
  class={combinedClass}
  style={themeStyles}
  on:click
  on:focus
  on:blur
  on:mouseenter
  on:mouseleave
>
  {#if loading}
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Loading...
  {:else}
    <slot />
  {/if}
</Button>

<style>
  :global(.themed-button) {
    /* Base button styling that works with theme system */
    font-family: var(--font-family);
    border-radius: var(--btn-border-radius);
    font-weight: var(--btn-font-weight);
    transition: var(--btn-transition);
  }
  
  /* Variant-specific styling */
  :global(.themed-button[data-variant="primary"]) {
    background-color: var(--btn-primary-bg) !important;
    color: var(--btn-primary-text) !important;
  }
  
  :global(.themed-button[data-variant="primary"]:hover) {
    background-color: var(--btn-primary-hover) !important;
  }
  
  :global(.themed-button[data-variant="secondary"]) {
    background-color: var(--btn-secondary-bg) !important;
    color: var(--btn-secondary-text) !important;
  }
  
  :global(.themed-button[data-variant="secondary"]:hover) {
    background-color: var(--btn-secondary-hover) !important;
  }
  
  :global(.themed-button[data-variant="accent"]) {
    background-color: var(--btn-accent-bg) !important;
    color: var(--btn-accent-text) !important;
    box-shadow: 0 0 10px color-mix(in srgb, var(--btn-accent-bg) 30%, transparent);
  }
  
  :global(.themed-button[data-variant="accent"]:hover) {
    background-color: var(--btn-accent-hover) !important;
    box-shadow: 0 0 20px color-mix(in srgb, var(--btn-accent-bg) 50%, transparent);
  }
  
  /* Focus states for accessibility */
  :global(.themed-button:focus-visible) {
    outline: 2px solid var(--color-outline);
    outline-offset: 2px;
  }
  
  /* Disabled state */
  :global(.themed-button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Loading state */
  :global(.themed-button.loading) {
    cursor: wait;
  }
</style>