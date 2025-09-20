<script>
  import { Card } from 'flowbite-svelte';
  import { currentColors } from '$lib/stores/theme.js';
  import { createEventDispatcher } from 'svelte';
  
  export let size = 'md';
  export let variant = 'default';
  export let padding = true;
  export let shadow = true;
  export let border = true;
  export let rounded = true;
  export let clickable = false;
  export let href = null;
  
  // Content props
  export let title = '';
  export let subtitle = '';
  export let image = '';
  export let imageAlt = '';
  
  // Custom theme props
  export let customClass = '';
  export let customStyle = '';
  
  const dispatch = createEventDispatcher();
  
  $: colors = $currentColors;
  
  // Generate theme styles
  $: themeStyles = `
    --card-bg: ${colors.surface};
    --card-border: ${colors.border};
    --card-text: ${colors.text};
    --card-text-muted: ${colors.textMuted};
    --card-shadow: var(--shadow-lg);
    --card-shadow-hover: var(--shadow-xl);
    --card-border-radius: var(--border-radius-lg);
    --card-transition: var(--transition-fast);
    ${customStyle}
  `;
  
  // Size variants
  $: sizeClasses = {
    xs: 'p-2',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10'
  };
  
  // Variant classes
  $: variantClass = {
    default: '',
    elevated: 'elevated-card',
    outlined: 'outlined-card',
    filled: 'filled-card',
    terminal: 'terminal-card',
    voice: 'voice-card',
    settings: 'settings-card'
  }[variant] || '';
  
  // Size class
  $: sizeClass = sizeClasses[size] || sizeClasses.md;
  
  $: combinedClass = `
    themed-card
    theme-transition
    ${variantClass}
    ${size || ''}
    ${clickable ? 'clickable' : ''}
    ${!padding ? 'no-padding' : ''}
    ${!shadow ? 'no-shadow' : ''}
    ${!border ? 'no-border' : ''}
    ${!rounded ? 'no-rounded' : ''}
    ${customClass}
  `.trim();
  
  function handleClick(event) {
    if (clickable) {
      dispatch('click', event);
    }
  }
  
  function handleKeydown(event) {
    if (clickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      dispatch('click', event);
    }
  }
</script>

<Card
  {href}
  class={combinedClass}
  style={themeStyles}
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  {#if image}
    <div class="themed-card-image">
      <img src={image} alt={imageAlt} />
    </div>
  {/if}
  
  <div class="themed-card-content {padding ? sizeClass : ''}">
    {#if title || subtitle}
      <div class="themed-card-header">
        {#if title}
          <h3 class="themed-card-title">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="themed-card-subtitle">{subtitle}</p>
        {/if}
      </div>
    {/if}
    
    <div class="themed-card-body">
      <slot />
    </div>
    
    {#if $$slots.footer}
      <div class="themed-card-footer">
        <slot name="footer" />
      </div>
    {/if}
  </div>
</Card>

<style>
  /* Base card styling */
  :global(.themed-card) {
    background-color: var(--card-bg) !important;
    border-color: var(--card-border) !important;
    color: var(--card-text) !important;
    border-radius: var(--card-border-radius) !important;
    transition: var(--card-transition) !important;
    font-family: var(--font-family) !important;
  }
  
  :global(.themed-card.no-shadow) {
    box-shadow: none !important;
  }
  
  :global(.themed-card.no-border) {
    border: none !important;
  }
  
  :global(.themed-card.no-rounded) {
    border-radius: 0 !important;
  }
  
  /* Card content */
  :global(.themed-card-content) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }
  
  :global(.themed-card.no-padding .themed-card-content) {
    padding: 0 !important;
  }
  
  /* Card image */
  :global(.themed-card-image) {
    margin: calc(-1 * var(--spacing-6));
    margin-bottom: 0;
    border-radius: var(--card-border-radius) var(--card-border-radius) 0 0;
    overflow: hidden;
  }
  
  :global(.themed-card-image img) {
    width: 100%;
    height: auto;
    display: block;
  }
  
  /* Card header */
  :global(.themed-card-header) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  
  :global(.themed-card-title) {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--card-text);
    margin: 0;
    line-height: var(--line-height-tight);
  }
  
  :global(.themed-card-subtitle) {
    font-size: var(--font-size-sm);
    color: var(--card-text-muted);
    margin: 0;
    line-height: var(--line-height-normal);
  }
  
  /* Card body */
  :global(.themed-card-body) {
    flex: 1;
    color: var(--card-text);
    line-height: var(--line-height-relaxed);
  }
  
  /* Card footer */
  :global(.themed-card-footer) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--card-border);
    margin-top: var(--spacing-4);
  }
  
  /* Clickable cards */
  :global(.themed-card.clickable) {
    cursor: pointer;
    transform: translateY(0);
    transition: 
      var(--card-transition),
      transform var(--transition-fast),
      box-shadow var(--transition-fast) !important;
  }
  
  :global(.themed-card.clickable:hover) {
    transform: translateY(-2px);
    box-shadow: var(--card-shadow-hover) !important;
  }
  
  :global(.themed-card.clickable:focus-visible) {
    outline: 2px solid var(--color-outline);
    outline-offset: 2px;
  }
  
  :global(.themed-card.clickable:active) {
    transform: translateY(0);
  }
  
  /* Variant-specific styling */
  
  /* Elevated variant */
  :global(.themed-card.elevated-card) {
    box-shadow: var(--shadow-xl) !important;
    border: none !important;
  }
  
  :global(.themed-card.elevated-card:hover) {
    box-shadow: var(--shadow-2xl) !important;
  }
  
  /* Outlined variant */
  :global(.themed-card.outlined-card) {
    background-color: transparent !important;
    border: 2px solid var(--card-border) !important;
    box-shadow: none !important;
  }
  
  /* Filled variant */
  :global(.themed-card.filled-card) {
    background-color: var(--color-primary) !important;
    color: var(--color-text-inverse) !important;
    border: none !important;
  }
  
  :global(.themed-card.filled-card .themed-card-title) {
    color: var(--color-text-inverse) !important;
  }
  
  :global(.themed-card.filled-card .themed-card-subtitle) {
    color: color-mix(in srgb, var(--color-text-inverse) 80%, transparent) !important;
  }
  
  :global(.themed-card.filled-card .themed-card-footer) {
    border-top-color: color-mix(in srgb, var(--color-text-inverse) 30%, transparent) !important;
  }
  
  /* Terminal variant */
  :global(.themed-card.terminal-card) {
    background-color: #000000 !important;
    color: var(--color-accent) !important;
    border: 1px solid var(--color-accent) !important;
    font-family: var(--font-family-mono) !important;
    box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent) !important;
  }
  
  :global(.themed-card.terminal-card .themed-card-title) {
    color: var(--color-accent) !important;
    text-shadow: 0 0 10px var(--color-accent);
  }
  
  :global(.themed-card.terminal-card .themed-card-subtitle) {
    color: color-mix(in srgb, var(--color-accent) 70%, transparent) !important;
  }
  
  /* Voice variant */
  :global(.themed-card.voice-card) {
    background: linear-gradient(135deg, var(--card-bg) 0%, color-mix(in srgb, var(--card-bg) 95%, var(--color-accent)) 100%) !important;
    border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent) !important;
  }
  
  :global(.themed-card.voice-card .themed-card-title) {
    background: linear-gradient(45deg, var(--color-primary), var(--color-accent));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    color: var(--color-primary);
  }
  
  /* Settings variant */
  :global(.themed-card.settings-card) {
    backdrop-filter: blur(8px);
    background-color: color-mix(in srgb, var(--card-bg) 90%, transparent) !important;
    border: 1px solid color-mix(in srgb, var(--card-border) 50%, transparent) !important;
  }
  
  /* Size adjustments */
  :global(.themed-card.xs .themed-card-title) {
    font-size: var(--font-size-lg);
  }
  
  :global(.themed-card.sm .themed-card-title) {
    font-size: var(--font-size-xl);
  }
  
  :global(.themed-card.lg .themed-card-title) {
    font-size: var(--font-size-2xl);
  }
  
  :global(.themed-card.xl .themed-card-title) {
    font-size: var(--font-size-3xl);
  }
  
  /* Responsive adjustments */
  @media (max-width: 640px) {
    :global(.themed-card-content) {
      gap: var(--spacing-3);
    }
    
    :global(.themed-card-footer) {
      flex-direction: column;
      align-items: stretch;
      gap: var(--spacing-2);
    }
    
    :global(.themed-card-image) {
      margin: calc(-1 * var(--spacing-4));
      margin-bottom: 0;
    }
  }
  
  /* High contrast mode */
  :global([data-theme-preset="high-contrast"] .themed-card) {
    border-width: 2px !important;
  }
  
  :global([data-theme-preset="high-contrast"] .themed-card.outlined-card) {
    border-width: 3px !important;
  }
  
  :global([data-theme-preset="high-contrast"] .themed-card-title) {
    font-weight: var(--font-weight-bold) !important;
  }
  
  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    :global(.themed-card) {
      transition: none !important;
    }
    
    :global(.themed-card.clickable) {
      transform: none !important;
      transition: none !important;
    }
    
    :global(.themed-card.clickable:hover) {
      transform: none !important;
    }
  }
</style>