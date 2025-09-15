<script>
  import { Modal, Button } from 'flowbite-svelte';
  import { currentColors } from '$lib/stores/theme.js';
  import { createEventDispatcher } from 'svelte';
  
  export let open = false;
  export let title = '';
  export let size = 'md';
  export let placement = 'center';
  export let backdrop = true;
  export let outsideclose = true;
  export let dismissable = true;
  export let autoclose = false;
  
  // Custom theme props
  export let customClass = '';
  export let customStyle = '';
  export let variant = 'default';
  
  const dispatch = createEventDispatcher();
  
  $: colors = $currentColors;
  
  // Generate theme styles
  $: themeStyles = `
    --modal-bg: ${colors.surface};
    --modal-border: ${colors.border};
    --modal-text: ${colors.text};
    --modal-backdrop: color-mix(in srgb, ${colors.background} 80%, transparent);
    --modal-shadow: var(--shadow-xl);
    --modal-border-radius: var(--border-radius-lg);
    --modal-backdrop-filter: blur(4px);
    ${customStyle}
  `;
  
  // Size variants
  $: sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl'
  };
  
  // Variant classes
  $: variantClass = {
    default: '',
    settings: 'settings-modal',
    terminal: 'terminal-modal',
    voice: 'voice-modal'
  }[variant] || '';
  
  $: combinedClass = `
    themed-modal
    theme-transition
    ${variantClass}
    ${customClass}
  `.trim();
  
  function handleClose() {
    open = false;
    dispatch('close');
  }
  
  function handleOpen() {
    dispatch('open');
  }
</script>

<Modal
  bind:open
  {title}
  {size}
  {placement}
  {backdrop}
  {outsideclose}
  {dismissable}
  {autoclose}
  class={combinedClass}
  style={themeStyles}
  on:close={handleClose}
  on:open={handleOpen}
>
  <svelte:fragment slot="header">
    {#if title}
      <h3 class="themed-modal-title">
        {title}
      </h3>
    {:else}
      <slot name="header" />
    {/if}
  </svelte:fragment>
  
  <div class="themed-modal-body">
    <slot />
  </div>
  
  <svelte:fragment slot="footer">
    <slot name="footer">
      <div class="themed-modal-footer">
        <Button 
          color="gray" 
          class="themed-modal-button secondary" 
          on:click={handleClose}
        >
          Cancel
        </Button>
        <Button 
          color="blue" 
          class="themed-modal-button primary"
          on:click={() => dispatch('confirm')}
        >
          Confirm
        </Button>
      </div>
    </slot>
  </svelte:fragment>
</Modal>

<style>
  /* Modal container styling */
  :global(.themed-modal) {
    font-family: var(--font-family) !important;
  }
  
  /* Modal backdrop */
  :global(.themed-modal .modal-backdrop) {
    background-color: var(--modal-backdrop) !important;
    backdrop-filter: var(--modal-backdrop-filter) !important;
  }
  
  /* Modal content */
  :global(.themed-modal .modal-content) {
    background-color: var(--modal-bg) !important;
    border: 1px solid var(--modal-border) !important;
    border-radius: var(--modal-border-radius) !important;
    box-shadow: var(--modal-shadow) !important;
    color: var(--modal-text) !important;
  }
  
  /* Modal header */
  :global(.themed-modal-title) {
    color: var(--color-text) !important;
    font-size: var(--font-size-xl) !important;
    font-weight: var(--font-weight-semibold) !important;
    margin: 0 !important;
  }
  
  :global(.themed-modal .modal-header) {
    border-bottom: 1px solid var(--color-border) !important;
    padding: var(--spacing-6) !important;
  }
  
  /* Modal body */
  :global(.themed-modal-body) {
    padding: var(--spacing-6);
    color: var(--color-text);
  }
  
  /* Modal footer */
  :global(.themed-modal-footer) {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding: var(--spacing-6);
    border-top: 1px solid var(--color-border);
  }
  
  :global(.themed-modal .modal-footer) {
    border-top: 1px solid var(--color-border) !important;
  }
  
  /* Modal buttons */
  :global(.themed-modal-button) {
    transition: var(--transition-fast) !important;
    border-radius: var(--border-radius-md) !important;
    font-weight: var(--font-weight-medium) !important;
  }
  
  :global(.themed-modal-button.primary) {
    background-color: var(--color-primary) !important;
    color: var(--color-text-inverse) !important;
    border-color: var(--color-primary) !important;
  }
  
  :global(.themed-modal-button.primary:hover) {
    background-color: color-mix(in srgb, var(--color-primary) 90%, black) !important;
  }
  
  :global(.themed-modal-button.secondary) {
    background-color: var(--color-surface) !important;
    color: var(--color-text) !important;
    border-color: var(--color-border) !important;
  }
  
  :global(.themed-modal-button.secondary:hover) {
    background-color: var(--color-surface-hover) !important;
  }
  
  /* Close button */
  :global(.themed-modal .modal-close-button) {
    color: var(--color-text-muted) !important;
    transition: var(--transition-fast) !important;
  }
  
  :global(.themed-modal .modal-close-button:hover) {
    color: var(--color-text) !important;
    background-color: var(--color-surface-hover) !important;
  }
  
  /* Variant-specific styling */
  
  /* Settings modal */
  :global(.themed-modal.settings-modal) {
    --modal-bg: var(--color-surface);
    --modal-border-radius: var(--border-radius-xl);
  }
  
  :global(.themed-modal.settings-modal .modal-content) {
    backdrop-filter: blur(8px) !important;
    border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent) !important;
  }
  
  /* Terminal modal */
  :global(.themed-modal.terminal-modal) {
    --modal-bg: #000000;
    --modal-text: var(--color-accent);
    --modal-border: var(--color-accent);
    --modal-border-radius: var(--border-radius-sm);
  }
  
  :global(.themed-modal.terminal-modal .modal-content) {
    font-family: var(--font-family-mono) !important;
    box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent) !important;
  }
  
  :global(.themed-modal.terminal-modal .themed-modal-title) {
    color: var(--color-accent) !important;
    text-shadow: 0 0 10px var(--color-accent) !important;
  }
  
  /* Voice modal */
  :global(.themed-modal.voice-modal) {
    --modal-border-radius: var(--border-radius-lg);
  }
  
  :global(.themed-modal.voice-modal .modal-content) {
    background: linear-gradient(135deg, var(--modal-bg) 0%, color-mix(in srgb, var(--modal-bg) 95%, var(--color-accent)) 100%) !important;
  }
  
  /* Animation overrides for theme transitions */
  :global(.themed-modal .modal-content) {
    transition: 
      background-color var(--transition-normal),
      border-color var(--transition-normal),
      color var(--transition-normal) !important;
  }
  
  /* Focus states for accessibility */
  :global(.themed-modal .modal-content:focus-within) {
    outline: 2px solid var(--color-outline);
    outline-offset: 2px;
  }
  
  /* Responsive adjustments */
  @media (max-width: 640px) {
    :global(.themed-modal .modal-content) {
      margin: var(--spacing-4) !important;
      border-radius: var(--border-radius-md) !important;
    }
    
    :global(.themed-modal-body) {
      padding: var(--spacing-4);
    }
    
    :global(.themed-modal .modal-header),
    :global(.themed-modal-footer) {
      padding: var(--spacing-4);
    }
    
    :global(.themed-modal-footer) {
      flex-direction: column;
      gap: var(--spacing-2);
    }
    
    :global(.themed-modal-button) {
      width: 100%;
    }
  }
  
  /* High contrast mode adjustments */
  :global([data-theme-preset="high-contrast"] .themed-modal .modal-content) {
    border-width: 2px !important;
  }
  
  :global([data-theme-preset="high-contrast"] .themed-modal-title) {
    font-weight: var(--font-weight-bold) !important;
  }
  
  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    :global(.themed-modal .modal-content) {
      transition: none !important;
    }
    
    :global(.themed-modal-button) {
      transition: none !important;
    }
  }
</style>