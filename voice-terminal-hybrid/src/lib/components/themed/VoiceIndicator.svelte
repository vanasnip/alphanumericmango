<script>
  import { currentColors, voiceStates } from '$lib/stores/theme.js';
  import { createEventDispatcher } from 'svelte';
  
  export let state = 'idle'; // idle, listening, processing, speaking, error
  export let size = 'md';
  export let confidence = 0;
  export let showConfidence = true;
  export let disabled = false;
  export let customClass = '';
  export let ariaLabel = 'Voice input control';
  
  const dispatch = createEventDispatcher();
  
  $: colors = $currentColors;
  $: states = $voiceStates;
  $: currentState = states[state] || states.idle;
  
  // Size variants
  $: sizeMap = {
    xs: '32px',
    sm: '40px', 
    md: '50px',
    lg: '64px',
    xl: '80px'
  };
  
  $: iconSizeMap = {
    xs: '0.875rem',
    sm: '1rem',
    md: '1.25rem', 
    lg: '1.5rem',
    xl: '2rem'
  };
  
  $: voiceSize = sizeMap[size] || sizeMap.md;
  $: iconSize = iconSizeMap[size] || iconSizeMap.md;
  
  // Dynamic styles based on current state and theme
  $: dynamicStyles = `
    --voice-size: ${voiceSize};
    --voice-color: ${currentState.color};
    --voice-border: ${currentState.borderColor};
    --voice-bg: ${currentState.backgroundColor};
    --voice-font-size: ${iconSize};
    --voice-animation: ${currentState.animation};
    --voice-box-shadow: ${currentState.boxShadow || 'none'};
  `;
  
  // Get appropriate icon for state
  $: stateIcon = {
    idle: '🎤',
    listening: '🔊',
    processing: '⏳',
    speaking: '🔈',
    error: '❌'
  }[state] || '🎤';
  
  // Get appropriate text for screen readers
  $: stateText = {
    idle: 'Click to start voice input',
    listening: 'Listening for voice input',
    processing: 'Processing voice input',
    speaking: 'System is responding',
    error: 'Voice input error occurred'
  }[state] || 'Voice input control';
  
  function handleClick() {
    if (!disabled) {
      dispatch('click', { state, confidence });
    }
  }
  
  function handleKeyDown(event) {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<div 
  class="voice-indicator-container {customClass}"
  role="region"
  aria-label="Voice input status"
>
  <!-- Main voice indicator button -->
  <button
    class="voice-indicator {state} theme-transition"
    class:disabled
    style={dynamicStyles}
    {disabled}
    tabindex={disabled ? -1 : 0}
    aria-label="{ariaLabel}: {stateText}"
    aria-pressed={state === 'listening'}
    aria-live="polite"
    aria-atomic="true"
    on:click={handleClick}
    on:keydown={handleKeyDown}
    on:mouseenter
    on:mouseleave
    on:focus
    on:blur
  >
    <!-- Icon content based on state -->
    {#if state === 'processing'}
      <div class="processing-indicator">
        <div class="processing-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    {:else if state === 'speaking'}
      <div class="waveform">
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
      </div>
    {:else}
      <span class="state-icon" aria-hidden="true">
        {stateIcon}
      </span>
    {/if}
    
    <!-- Ripple effect for listening state -->
    {#if state === 'listening'}
      <div class="ripple-effect"></div>
    {/if}
    
    <!-- Screen reader text -->
    <span class="sr-only">{stateText}</span>
  </button>
  
  <!-- Confidence meter -->
  {#if showConfidence && state === 'listening' && confidence > 0}
    <div class="confidence-display" aria-label="Voice confidence: {Math.round(confidence * 100)}%">
      <div class="confidence-bar">
        <div 
          class="confidence-fill"
          style="width: {confidence * 100}%"
          aria-hidden="true"
        ></div>
      </div>
      <span class="confidence-text sr-only">
        {Math.round(confidence * 100)}% confidence
      </span>
    </div>
  {/if}
  
  <!-- Status text -->
  {#if state !== 'idle'}
    <div class="voice-status {state}">
      <span class="status-text">
        {#if state === 'listening'}
          Listening...
        {:else if state === 'processing'}
          Processing...
        {:else if state === 'speaking'}
          Speaking...
        {:else if state === 'error'}
          Error occurred
        {/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .voice-indicator-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    position: relative;
  }
  
  .voice-indicator {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--voice-size);
    height: var(--voice-size);
    border: var(--border-width-thick) solid var(--voice-border);
    border-radius: var(--border-radius-full);
    background: var(--voice-bg);
    color: var(--voice-color);
    font-size: var(--voice-font-size);
    cursor: pointer;
    transition: var(--transition-normal);
    user-select: none;
    outline: none;
    animation: var(--voice-animation);
    box-shadow: var(--voice-box-shadow);
    z-index: 1;
  }
  
  .voice-indicator:hover:not(.disabled) {
    transform: scale(1.05);
  }
  
  .voice-indicator:focus-visible {
    outline: 2px solid var(--color-outline);
    outline-offset: 2px;
  }
  
  .voice-indicator.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    animation: none;
  }
  
  /* State icon */
  .state-icon {
    font-size: inherit;
    line-height: 1;
  }
  
  /* Processing indicator */
  .processing-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .processing-dots {
    display: flex;
    gap: 3px;
  }
  
  .dot {
    width: 4px;
    height: 4px;
    background: currentColor;
    border-radius: 50%;
    animation: processing-dots 1.5s ease-in-out infinite;
  }
  
  .dot:nth-child(2) {
    animation-delay: 0.5s;
  }
  
  .dot:nth-child(3) {
    animation-delay: 1s;
  }
  
  /* Waveform for speaking state */
  .waveform {
    display: flex;
    align-items: end;
    gap: 2px;
    height: 20px;
  }
  
  .waveform-bar {
    width: 3px;
    background: currentColor;
    border-radius: 1px;
    animation: speaking-bars 0.6s ease-in-out infinite;
  }
  
  .waveform-bar:nth-child(1) { animation-delay: 0s; }
  .waveform-bar:nth-child(2) { animation-delay: 0.1s; }
  .waveform-bar:nth-child(3) { animation-delay: 0.2s; }
  .waveform-bar:nth-child(4) { animation-delay: 0.1s; }
  .waveform-bar:nth-child(5) { animation-delay: 0s; }
  
  /* Ripple effect for listening */
  .ripple-effect {
    position: absolute;
    top: -10px;
    left: -10px;
    right: -10px;
    bottom: -10px;
    border: 2px solid currentColor;
    border-radius: 50%;
    opacity: 0;
    animation: listening-ripple 2s ease-out infinite;
    pointer-events: none;
    z-index: -1;
  }
  
  /* Confidence display */
  .confidence-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-1);
    min-width: 100px;
  }
  
  .confidence-bar {
    width: 100%;
    height: 4px;
    background: var(--color-surface-secondary);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
  }
  
  .confidence-fill {
    height: 100%;
    border-radius: var(--border-radius-sm);
    transition: width var(--transition-fast);
    background: linear-gradient(
      90deg,
      var(--color-error) 0%,
      var(--color-warning) 50%,
      var(--color-success) 100%
    );
  }
  
  /* Status text */
  .voice-status {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-xs);
    transition: var(--transition-fast);
  }
  
  .voice-status.listening {
    background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  
  .voice-status.processing {
    background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
    border-color: var(--color-warning);
    color: var(--color-warning);
  }
  
  .voice-status.speaking {
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  
  .voice-status.error {
    background: color-mix(in srgb, var(--color-error) 10%, var(--color-surface));
    border-color: var(--color-error);
    color: var(--color-error);
  }
  
  .status-text {
    font-weight: var(--font-weight-medium);
  }
  
  /* Screen reader only */
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
  
  /* Animations */
  @keyframes processing-dots {
    0%, 80%, 100% { 
      transform: scale(0.8); 
      opacity: 0.5; 
    }
    40% { 
      transform: scale(1.2); 
      opacity: 1; 
    }
  }
  
  @keyframes speaking-bars {
    0%, 100% { height: 8px; }
    50% { height: 20px; }
  }
  
  @keyframes listening-ripple {
    0% {
      transform: scale(0.8);
      opacity: 1;
    }
    100% {
      transform: scale(1.2);
      opacity: 0;
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translateY(0);
    }
    40%, 43% {
      transform: translateY(-8px);
    }
    70% {
      transform: translateY(-4px);
    }
    90% {
      transform: translateY(-2px);
    }
  }

  @keyframes shake {
    0%, 100% {
      transform: translateX(0);
    }
    10%, 30%, 50%, 70%, 90% {
      transform: translateX(-4px);
    }
    20%, 40%, 60%, 80% {
      transform: translateX(4px);
    }
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    .voice-indicator {
      border-width: 3px;
    }
    
    .voice-indicator.listening {
      background: var(--color-accent);
      color: var(--color-background);
    }
  }
  
  /* Reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .voice-indicator,
    .ripple-effect,
    .dot,
    .waveform-bar,
    .confidence-fill {
      animation: none !important;
    }
    
    .voice-indicator:hover:not(.disabled) {
      transform: none;
    }
    
    .voice-indicator.listening {
      background: color-mix(in srgb, var(--color-accent) 20%, transparent);
    }
  }
  
  /* Responsive sizing */
  @media (max-width: 640px) {
    .voice-indicator-container {
      gap: var(--spacing-1);
    }
    
    .confidence-display {
      min-width: 80px;
    }
    
    .voice-status {
      font-size: var(--font-size-xs);
      padding: calc(var(--spacing-1) * 0.5) var(--spacing-1);
    }
  }
</style>