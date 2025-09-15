<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import SettingsEditorLayout from './SettingsEditorLayout.svelte';
  import SettingsControls from './SettingsControls.svelte';
  import JsonEditor from './JsonEditor.svelte';
  import LivePreview from './LivePreview.svelte';
  import FeedbackComponents from './FeedbackComponents.svelte';

  // Props
  export let theme = null;
  export let presets = [];
  export let readonly = false;

  // State management
  let selectedPreset = 'default';
  let jsonValue = '';
  let validationErrors = [];
  let searchQuery = '';
  let hasUnsavedChanges = false;
  let canUndo = false;
  let canRedo = false;
  
  // UI state
  let showComparison = false;
  let compareTheme = null;
  let isLoading = false;
  let loadingStates = {};
  let toasts = [];
  let showConfirmModal = false;
  let showHelpModal = false;
  let confirmAction = null;
  
  // Accessibility state
  let announcements = writable('');
  let focusedElement = null;
  let keyboardNavigation = false;
  
  // Responsive breakpoints
  let screenSize = 'desktop';
  let isMobile = false;
  let isTablet = false;
  let isDesktop = true;
  
  // Performance optimization
  let previewUpdateDebounce;
  let validationDebounce;

  // Initialize component
  onMount(() => {
    setupResponsiveDetection();
    setupKeyboardNavigation();
    setupA11yAnnouncements();
    loadInitialTheme();
    
    return () => {
      clearTimeout(previewUpdateDebounce);
      clearTimeout(validationDebounce);
    };
  });

  function setupResponsiveDetection() {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      
      if (width < 768) {
        screenSize = 'mobile';
        isMobile = true;
        isTablet = false;
        isDesktop = false;
      } else if (width < 1024) {
        screenSize = 'tablet';
        isMobile = false;
        isTablet = true;
        isDesktop = false;
      } else {
        screenSize = 'desktop';
        isMobile = false;
        isTablet = false;
        isDesktop = true;
      }
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }

  function setupKeyboardNavigation() {
    const handleKeydown = (event) => {
      // Track if user is using keyboard navigation
      if (event.key === 'Tab') {
        keyboardNavigation = true;
        document.body.classList.add('keyboard-navigation');
      }
    };
    
    const handleMouseDown = () => {
      keyboardNavigation = false;
      document.body.classList.remove('keyboard-navigation');
    };
    
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }

  function setupA11yAnnouncements() {
    // Create live region for screen reader announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('class', 'sr-only');
    liveRegion.setAttribute('id', 'settings-announcements');
    document.body.appendChild(liveRegion);
    
    // Subscribe to announcements
    announcements.subscribe(message => {
      if (message) {
        liveRegion.textContent = message;
        setTimeout(() => {
          announcements.set('');
        }, 100);
      }
    });
    
    return () => {
      const element = document.getElementById('settings-announcements');
      if (element) {
        element.remove();
      }
    };
  }

  function loadInitialTheme() {
    if (theme) {
      jsonValue = JSON.stringify(theme, null, 2);
      selectedPreset = theme.preset || 'default';
    }
  }

  function announce(message) {
    announcements.set(message);
  }

  // Event handlers
  function handlePresetChange(event) {
    const { preset } = event.detail;
    selectedPreset = preset;
    
    setLoadingState('loading', true);
    
    // Simulate loading preset
    setTimeout(() => {
      const presetData = presets.find(p => p.id === preset);
      if (presetData) {
        jsonValue = JSON.stringify(presetData.theme, null, 2);
        hasUnsavedChanges = true;
        announce(`Applied ${presetData.name} preset`);
        addToast('success', `Applied ${presetData.name} preset`);
      }
      setLoadingState('loading', false);
    }, 500);
  }

  function handleJsonInput(event) {
    jsonValue = event.detail.value;
    hasUnsavedChanges = true;
    
    // Debounced validation
    clearTimeout(validationDebounce);
    validationDebounce = setTimeout(() => {
      validateTheme();
      updatePreview();
    }, 500);
  }

  function validateTheme() {
    try {
      const parsed = JSON.parse(jsonValue);
      validationErrors = [];
      theme = parsed;
      announce('Theme validation passed');
    } catch (error) {
      validationErrors = [{
        path: 'JSON',
        message: error.message
      }];
      announce('Theme validation failed');
    }
  }

  function updatePreview() {
    clearTimeout(previewUpdateDebounce);
    previewUpdateDebounce = setTimeout(() => {
      if (validationErrors.length === 0) {
        // Update preview with new theme
        theme = { ...theme };
      }
    }, 200);
  }

  function handleSave() {
    if (!hasUnsavedChanges) return;
    
    setLoadingState('saving', true);
    
    // Simulate save operation
    setTimeout(() => {
      hasUnsavedChanges = false;
      setLoadingState('saving', false);
      addToast('success', 'Theme saved successfully');
      announce('Theme saved successfully');
    }, 1000);
  }

  function handleExport() {
    setLoadingState('exporting', true);
    
    setTimeout(() => {
      const blob = new Blob([jsonValue], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `theme-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setLoadingState('exporting', false);
      addToast('success', 'Theme exported successfully');
      announce('Theme exported successfully');
    }, 500);
  }

  function handleImport(event) {
    const { file } = event.detail;
    setLoadingState('importing', true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTheme = JSON.parse(e.target.result);
        jsonValue = JSON.stringify(importedTheme, null, 2);
        hasUnsavedChanges = true;
        validateTheme();
        
        setLoadingState('importing', false);
        addToast('success', 'Theme imported successfully');
        announce('Theme imported successfully');
      } catch (error) {
        setLoadingState('importing', false);
        addToast('error', 'Failed to import theme: Invalid JSON');
        announce('Theme import failed');
      }
    };
    
    reader.readAsText(file);
  }

  function handleReset() {
    confirmAction = () => {
      jsonValue = JSON.stringify(getDefaultTheme(), null, 2);
      selectedPreset = 'default';
      hasUnsavedChanges = true;
      validationErrors = [];
      validateTheme();
      addToast('info', 'Theme reset to default');
      announce('Theme reset to default');
    };
    
    showConfirmModal = true;
  }

  function handleUndo() {
    // Implement undo logic
    canRedo = true;
    addToast('info', 'Changes undone');
    announce('Changes undone');
  }

  function handleRedo() {
    // Implement redo logic
    canUndo = true;
    addToast('info', 'Changes redone');
    announce('Changes redone');
  }

  function handleSearch(event) {
    const { query } = event.detail;
    searchQuery = query;
    // Implement search highlighting in JSON editor
    announce(`Searching for: ${query}`);
  }

  function addToast(type, message, duration = 5000) {
    const toast = {
      id: Date.now(),
      type,
      message,
      duration,
      timestamp: new Date()
    };
    toasts = [...toasts, toast];
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(toasts.findIndex(t => t.id === toast.id));
      }, duration);
    }
  }

  function removeToast(index) {
    if (index >= 0) {
      toasts = toasts.filter((_, i) => i !== index);
    }
  }

  function setLoadingState(key, loading) {
    loadingStates = {
      ...loadingStates,
      [key]: loading
    };
  }

  function getDefaultTheme() {
    return {
      mode: 'dark',
      preset: 'default',
      global: {
        colors: {
          primary: '#3B82F6',
          secondary: '#8B5CF6',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          background: '#1F2937',
          surface: '#374151',
          text: '#F9FAFB'
        }
      }
    };
  }

  // Skip to content functionality for accessibility
  function skipToContent() {
    const contentElement = document.querySelector('.json-editor textarea');
    if (contentElement) {
      contentElement.focus();
      announce('Skipped to main content');
    }
  }

  // High contrast mode detection
  let highContrastMode = false;
  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    highContrastMode = mediaQuery.matches;
    
    const handleChange = (e) => {
      highContrastMode = e.matches;
    };
    
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  });

  // Reduced motion detection
  let reducedMotion = false;
  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mediaQuery.matches;
    
    const handleChange = (e) => {
      reducedMotion = e.matches;
    };
    
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  });
</script>

<!-- Skip to content link for screen readers -->
<a href="#main-content" class="skip-link" on:click={skipToContent}>
  Skip to main content
</a>

<!-- Main Settings Editor -->
<div 
  class="settings-editor"
  class:mobile={isMobile}
  class:tablet={isTablet}
  class:desktop={isDesktop}
  class:high-contrast={highContrastMode}
  class:reduced-motion={reducedMotion}
  class:keyboard-nav={keyboardNavigation}
  role="application"
  aria-label="Theme Settings Editor"
>
  <!-- Editor Layout -->
  <SettingsEditorLayout
    showSidebar={true}
    showPreview={!isMobile || screenSize !== 'mobile'}
  >
    <!-- Sidebar Controls -->
    <SettingsControls
      slot="sidebar"
      {presets}
      {selectedPreset}
      {canUndo}
      {canRedo}
      {hasUnsavedChanges}
      {isLoading}
      collapsed={false}
      searchEnabled={true}
      on:presetChange={handlePresetChange}
      on:save={handleSave}
      on:export={handleExport}
      on:import={handleImport}
      on:reset={handleReset}
      on:undo={handleUndo}
      on:redo={handleRedo}
      on:search={handleSearch}
      on:clearSearch={() => searchQuery = ''}
    />

    <!-- JSON Editor -->
    <div slot="editor" id="main-content">
      <JsonEditor
        bind:value={jsonValue}
        {validationErrors}
        suggestions={['colors', 'typography', 'spacing', 'borders', 'components']}
        {readonly}
        lineNumbers={true}
        autoComplete={true}
        colorPicker={true}
        on:input={handleJsonInput}
        on:save={handleSave}
      />
    </div>

    <!-- Live Preview -->
    <LivePreview
      slot="preview"
      {theme}
      {compareTheme}
      {showComparison}
      collapsed={false}
      on:stateChange={(e) => announce(`Component state changed to ${e.detail.state}`)}
      on:export={(e) => announce('Preview exported')}
      on:fullscreen={(e) => announce(e.detail.fullscreen ? 'Entered fullscreen' : 'Exited fullscreen')}
    />
  </SettingsEditorLayout>

  <!-- Feedback Components -->
  <FeedbackComponents
    {toasts}
    {showConfirmModal}
    {showHelpModal}
    {loadingStates}
    {validationErrors}
    showProgress={false}
    progressValue={0}
    progressLabel=""
    {confirmAction}
    confirmTitle="Reset Theme"
    confirmMessage="Are you sure you want to reset the theme to default? This will lose all unsaved changes."
    confirmType="warning"
    on:toastRemoved={(e) => removeToast(e.detail.index)}
    on:confirmed={() => showConfirmModal = false}
    on:cancelled={() => showConfirmModal = false}
    on:helpClosed={() => showHelpModal = false}
    on:errorDismissed={(e) => {
      validationErrors = validationErrors.filter((_, i) => i !== e.detail.index);
      announce('Validation error dismissed');
    }}
    on:allErrorsDismissed={() => {
      validationErrors = [];
      announce('All validation errors dismissed');
    }}
  />
</div>

<style>
  .skip-link {
    position: absolute;
    top: -40px;
    left: 6px;
    background: var(--theme-primary);
    color: white;
    padding: 8px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 100;
    font-weight: 500;
  }

  .skip-link:focus {
    top: 6px;
  }

  .settings-editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--theme-background);
    color: var(--theme-text);
    font-family: var(--theme-font-family, 'Inter, system-ui');
    
    /* CSS Custom Properties for Responsive Design */
    --mobile-breakpoint: 768px;
    --tablet-breakpoint: 1024px;
    --desktop-breakpoint: 1200px;
    
    /* Component Spacing */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    
    /* Animation Durations */
    --duration-fast: 150ms;
    --duration-normal: 300ms;
    --duration-slow: 500ms;
  }

  /* Mobile Styles */
  .settings-editor.mobile {
    --spacing-unit: 0.75rem;
    font-size: 14px;
  }

  .settings-editor.mobile :global(.flowbite-button) {
    padding: 0.5rem 0.75rem;
  }

  .settings-editor.mobile :global(.flowbite-input) {
    padding: 0.5rem;
  }

  /* Tablet Styles */
  .settings-editor.tablet {
    --spacing-unit: 1rem;
    font-size: 15px;
  }

  /* Desktop Styles */
  .settings-editor.desktop {
    --spacing-unit: 1rem;
    font-size: 16px;
  }

  /* High Contrast Mode */
  .settings-editor.high-contrast {
    --theme-border-width: 2px;
    filter: contrast(1.5);
  }

  .settings-editor.high-contrast :global(*) {
    border-width: var(--theme-border-width, 1px) !important;
  }

  .settings-editor.high-contrast :global(.flowbite-button) {
    border: 2px solid currentColor !important;
  }

  /* Reduced Motion */
  .settings-editor.reduced-motion,
  .settings-editor.reduced-motion :global(*) {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Keyboard Navigation */
  .settings-editor.keyboard-nav :global(*:focus) {
    outline: 3px solid var(--theme-primary) !important;
    outline-offset: 2px !important;
  }

  .settings-editor.keyboard-nav :global(.flowbite-button:focus) {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-primary) 30%, transparent) !important;
  }

  /* Focus Management */
  .settings-editor :global(.focus-trap) {
    position: relative;
  }

  .settings-editor :global(.focus-trap::before),
  .settings-editor :global(.focus-trap::after) {
    content: '';
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Screen Reader Only */
  .settings-editor :global(.sr-only) {
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

  /* Print Styles */
  @media print {
    .settings-editor {
      background: white !important;
      color: black !important;
    }
    
    .settings-editor :global(.no-print) {
      display: none !important;
    }
  }

  /* Container Queries (Future-proofing) */
  @container (max-width: 768px) {
    .settings-editor {
      font-size: 14px;
    }
  }

  @container (min-width: 1200px) {
    .settings-editor {
      font-size: 16px;
    }
  }

  /* Custom Scrollbars */
  .settings-editor :global(*::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  .settings-editor :global(*::-webkit-scrollbar-track) {
    background: color-mix(in srgb, var(--theme-surface) 50%, transparent);
    border-radius: 4px;
  }

  .settings-editor :global(*::-webkit-scrollbar-thumb) {
    background: color-mix(in srgb, var(--theme-text) 30%, transparent);
    border-radius: 4px;
  }

  .settings-editor :global(*::-webkit-scrollbar-thumb:hover) {
    background: color-mix(in srgb, var(--theme-text) 50%, transparent);
  }

  /* Firefox Scrollbars */
  .settings-editor :global(*) {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--theme-text) 30%, transparent) 
                     color-mix(in srgb, var(--theme-surface) 50%, transparent);
  }

  /* Touch Device Optimizations */
  @media (hover: none) and (pointer: coarse) {
    .settings-editor :global(.flowbite-button) {
      min-height: 44px;
      min-width: 44px;
    }
    
    .settings-editor :global(.flowbite-input) {
      min-height: 44px;
    }
    
    .settings-editor :global(.resize-handle) {
      width: 12px;
      height: 12px;
    }
  }

  /* Prefers Color Scheme */
  @media (prefers-color-scheme: dark) {
    .settings-editor {
      color-scheme: dark;
    }
  }

  @media (prefers-color-scheme: light) {
    .settings-editor {
      color-scheme: light;
    }
  }

  /* Error States */
  .settings-editor :global(.error) {
    border-color: var(--theme-error) !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-error) 20%, transparent) !important;
  }

  /* Success States */
  .settings-editor :global(.success) {
    border-color: var(--theme-success) !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-success) 20%, transparent) !important;
  }

  /* Loading States */
  .settings-editor :global(.loading) {
    cursor: wait;
    opacity: 0.7;
    pointer-events: none;
  }

  /* Disabled States */
  .settings-editor :global(:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>