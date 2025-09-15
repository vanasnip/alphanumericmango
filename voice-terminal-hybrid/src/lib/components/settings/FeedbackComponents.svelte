<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { 
    Toast, 
    Modal, 
    Button, 
    Alert, 
    Spinner,
    Progress,
    Tooltip,
    Popover,
    Card
  } from 'flowbite-svelte';
  import { 
    CheckCircleOutline,
    ExclamationTriangleOutline,
    XCircleOutline,
    InformationCircleOutline,
    XMarkOutline,
    QuestionMarkCircleOutline,
    ClockOutline,
    DocumentCheckOutline,
    ArrowDownTrayOutline
  } from 'flowbite-svelte-icons';

  const dispatch = createEventDispatcher();

  // Toast notifications
  export let toasts = [];
  export let showConfirmModal = false;
  export let showHelpModal = false;
  export let loadingStates = {};
  export let validationErrors = [];
  export let showProgress = false;
  export let progressValue = 0;
  export let progressLabel = '';

  // Confirmation modal props
  export let confirmAction = null;
  export let confirmTitle = 'Confirm Action';
  export let confirmMessage = 'Are you sure you want to proceed?';
  export let confirmType = 'warning'; // 'warning', 'danger', 'info'

  // Help modal props
  export let helpContent = null;

  // Loading states
  const loadingMessages = {
    saving: 'Saving theme...',
    loading: 'Loading theme...',
    exporting: 'Exporting theme...',
    importing: 'Importing theme...',
    validating: 'Validating theme...',
    applying: 'Applying changes...'
  };

  // Toast management
  function removeToast(index) {
    toasts = toasts.filter((_, i) => i !== index);
    dispatch('toastRemoved', { index });
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
    
    return toast;
  }

  // Modal handlers
  function handleConfirm() {
    if (confirmAction) {
      confirmAction();
    }
    showConfirmModal = false;
    dispatch('confirmed');
  }

  function handleCancel() {
    showConfirmModal = false;
    dispatch('cancelled');
  }

  function closeHelp() {
    showHelpModal = false;
    dispatch('helpClosed');
  }

  // Validation error handling
  function dismissError(index) {
    validationErrors = validationErrors.filter((_, i) => i !== index);
    dispatch('errorDismissed', { index });
  }

  function dismissAllErrors() {
    validationErrors = [];
    dispatch('allErrorsDismissed');
  }

  // Export public methods
  export { addToast };
</script>

<!-- Toast Notifications Container -->
<div class="toast-container">
  {#each toasts as toast, index (toast.id)}
    <div
      class="toast-wrapper"
      in:fly={{ y: -20, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <Toast
        color={toast.type === 'success' ? 'green' : 
              toast.type === 'error' ? 'red' : 
              toast.type === 'warning' ? 'yellow' : 'blue'}
        dismissable
        on:close={() => removeToast(index)}
      >
        <div slot="icon">
          {#if toast.type === 'success'}
            <CheckCircleOutline class="w-5 h-5" />
          {:else if toast.type === 'error'}
            <XCircleOutline class="w-5 h-5" />
          {:else if toast.type === 'warning'}
            <ExclamationTriangleOutline class="w-5 h-5" />
          {:else}
            <InformationCircleOutline class="w-5 h-5" />
          {/if}
        </div>
        
        <div class="toast-content">
          <p class="toast-message">{toast.message}</p>
          {#if toast.timestamp}
            <p class="toast-timestamp">
              {toast.timestamp.toLocaleTimeString()}
            </p>
          {/if}
        </div>
      </Toast>
    </div>
  {/each}
</div>

<!-- Validation Errors Alert -->
{#if validationErrors.length > 0}
  <div class="validation-errors" in:scale={{ duration: 300 }}>
    <Alert color="red" border dismissable>
      <ExclamationTriangleOutline slot="icon" class="w-5 h-5" />
      
      <div class="error-header">
        <h4 class="error-title">
          {validationErrors.length} Validation Error{validationErrors.length > 1 ? 's' : ''}
        </h4>
        <Button
          size="xs"
          color="red"
          on:click={dismissAllErrors}
        >
          Dismiss All
        </Button>
      </div>
      
      <div class="error-list">
        {#each validationErrors as error, index}
          <div class="error-item">
            <div class="error-details">
              <span class="error-path">{error.path || 'Root'}</span>
              <span class="error-message">{error.message}</span>
            </div>
            <Button
              size="xs"
              color="ghost"
              on:click={() => dismissError(index)}
            >
              <XMarkOutline class="w-3 h-3" />
            </Button>
          </div>
        {/each}
      </div>
    </Alert>
  </div>
{/if}

<!-- Progress Indicator -->
{#if showProgress}
  <div class="progress-container" in:scale={{ duration: 300 }}>
    <Card class="progress-card">
      <div class="progress-content">
        <div class="progress-header">
          <span class="progress-label">{progressLabel || 'Processing...'}</span>
          <span class="progress-percentage">{Math.round(progressValue)}%</span>
        </div>
        
        <Progress {progressValue} color="blue" class="progress-bar" />
        
        <div class="progress-footer">
          <ClockOutline class="w-4 h-4" />
          <span class="progress-eta">Estimated time remaining: 2s</span>
        </div>
      </div>
    </Card>
  </div>
{/if}

<!-- Loading States -->
{#each Object.entries(loadingStates) as [key, isLoading]}
  {#if isLoading}
    <div class="loading-overlay" in:fade={{ duration: 200 }}>
      <div class="loading-content">
        <Spinner size="8" color="blue" />
        <p class="loading-message">
          {loadingMessages[key] || 'Loading...'}
        </p>
      </div>
    </div>
  {/if}
{/each}

<!-- Confirmation Modal -->
<Modal bind:open={showConfirmModal} size="sm" class="confirmation-modal">
  <div class="modal-content">
    <div class="modal-header">
      <div class="modal-icon" class:warning={confirmType === 'warning'} class:danger={confirmType === 'danger'}>
        {#if confirmType === 'danger'}
          <XCircleOutline class="w-6 h-6" />
        {:else if confirmType === 'warning'}
          <ExclamationTriangleOutline class="w-6 h-6" />
        {:else}
          <QuestionMarkCircleOutline class="w-6 h-6" />
        {/if}
      </div>
      <h3 class="modal-title">{confirmTitle}</h3>
    </div>
    
    <div class="modal-body">
      <p class="modal-message">{confirmMessage}</p>
    </div>
    
    <div class="modal-footer">
      <Button
        color="ghost"
        on:click={handleCancel}
      >
        Cancel
      </Button>
      <Button
        color={confirmType === 'danger' ? 'red' : 'primary'}
        on:click={handleConfirm}
      >
        {confirmType === 'danger' ? 'Delete' : 'Confirm'}
      </Button>
    </div>
  </div>
</Modal>

<!-- Help Modal -->
<Modal bind:open={showHelpModal} size="lg" class="help-modal">
  <div class="help-content">
    <div class="help-header">
      <h3 class="help-title">Theme Editor Help</h3>
      <Button
        size="sm"
        color="ghost"
        on:click={closeHelp}
      >
        <XMarkOutline class="w-4 h-4" />
      </Button>
    </div>
    
    <div class="help-body">
      {#if helpContent}
        <svelte:component this={helpContent} />
      {:else}
        <div class="help-sections">
          <div class="help-section">
            <h4>Getting Started</h4>
            <p>Use the theme editor to customize your application's appearance. Select a preset or create your own custom theme.</p>
          </div>
          
          <div class="help-section">
            <h4>JSON Editor</h4>
            <p>Edit theme properties directly in JSON format. The editor provides syntax highlighting and validation.</p>
          </div>
          
          <div class="help-section">
            <h4>Live Preview</h4>
            <p>See your changes in real-time with the live preview panel. Toggle different component states to test your theme.</p>
          </div>
          
          <div class="help-section">
            <h4>Keyboard Shortcuts</h4>
            <ul class="shortcuts-list">
              <li><kbd>⌘S</kbd> - Save theme</li>
              <li><kbd>⌘Z</kbd> - Undo</li>
              <li><kbd>⌘⇧Z</kbd> - Redo</li>
              <li><kbd>⌘F</kbd> - Search</li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </div>
</Modal>

<!-- Help Tooltips -->
<div class="help-tooltips">
  <!-- JSON Editor Help -->
  <Tooltip
    content="Edit theme properties directly in JSON format"
    placement="top"
    class="editor-help"
  >
    <Button size="xs" color="ghost" class="help-trigger">
      <QuestionMarkCircleOutline class="w-3 h-3" />
    </Button>
  </Tooltip>
  
  <!-- Preview Help -->
  <Tooltip
    content="Preview your theme changes in real-time"
    placement="top"
    class="preview-help"
  >
    <Button size="xs" color="ghost" class="help-trigger">
      <QuestionMarkCircleOutline class="w-3 h-3" />
    </Button>
  </Tooltip>
</div>

<!-- Success Confirmation Popover -->
<div class="success-popover">
  <Popover
    title="Theme Saved"
    placement="top"
    class="save-confirmation"
  >
    <div slot="content" class="popover-content">
      <CheckCircleOutline class="w-4 h-4 text-green-500" />
      <span>Your theme has been saved successfully!</span>
    </div>
  </Popover>
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 400px;
  }

  .toast-wrapper {
    width: 100%;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toast-message {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .toast-timestamp {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .validation-errors {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 40;
    max-width: 500px;
    width: 90vw;
  }

  .error-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .error-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .error-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .error-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    background-color: color-mix(in srgb, var(--theme-surface) 50%, transparent);
    border-radius: 0.375rem;
    border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  }

  .error-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .error-path {
    font-size: 0.75rem;
    font-weight: 500;
    color: #ef4444;
    font-family: 'JetBrains Mono', monospace;
  }

  .error-message {
    font-size: 0.875rem;
    color: var(--theme-text);
  }

  .progress-container {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 40;
    width: 300px;
  }

  .progress-card {
    background-color: var(--theme-surface);
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
  }

  .progress-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .progress-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-text);
  }

  .progress-percentage {
    font-size: 0.75rem;
    font-weight: 600;
    color: #3b82f6;
    font-family: 'JetBrains Mono', monospace;
  }

  .progress-bar {
    width: 100%;
  }

  .progress-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 45;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    background-color: var(--theme-surface);
    border-radius: 0.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .loading-message {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: var(--theme-text);
    text-align: center;
  }

  /* Modal Styles */
  :global(.confirmation-modal) {
    background-color: var(--theme-surface);
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .modal-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background-color: color-mix(in srgb, #3b82f6 10%, transparent);
    color: #3b82f6;
  }

  .modal-icon.warning {
    background-color: color-mix(in srgb, #f59e0b 10%, transparent);
    color: #f59e0b;
  }

  .modal-icon.danger {
    background-color: color-mix(in srgb, #ef4444 10%, transparent);
    color: #ef4444;
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .modal-body {
    padding: 0 1rem;
  }

  .modal-message {
    margin: 0;
    font-size: 0.875rem;
    color: color-mix(in srgb, var(--theme-text) 80%, transparent);
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  /* Help Modal */
  :global(.help-modal) {
    background-color: var(--theme-surface);
  }

  .help-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
  }

  .help-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .help-body {
    overflow-y: auto;
    max-height: 60vh;
  }

  .help-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .help-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .help-section h4 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-text);
  }

  .help-section p {
    margin: 0;
    font-size: 0.875rem;
    color: color-mix(in srgb, var(--theme-text) 80%, transparent);
    line-height: 1.5;
  }

  .shortcuts-list {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
    color: color-mix(in srgb, var(--theme-text) 80%, transparent);
  }

  .shortcuts-list li {
    margin-bottom: 0.25rem;
  }

  .shortcuts-list kbd {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    padding: 0.125rem 0.25rem;
    background-color: var(--theme-surface);
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
    border-radius: 0.25rem;
  }

  .help-tooltips {
    display: none; /* Hidden by default, shown contextually */
  }

  .help-trigger {
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .help-trigger:hover {
    opacity: 1;
  }

  .success-popover {
    display: none; /* Shown programmatically */
  }

  .popover-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .toast-container {
      top: 0.5rem;
      right: 0.5rem;
      left: 0.5rem;
      max-width: none;
    }

    .validation-errors {
      width: 95vw;
      max-width: none;
    }

    .progress-container {
      bottom: 0.5rem;
      right: 0.5rem;
      left: 0.5rem;
      width: auto;
    }

    .modal-header {
      flex-direction: column;
      text-align: center;
    }

    .modal-footer {
      flex-direction: column-reverse;
    }

    .help-body {
      max-height: 50vh;
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .error-item {
      border-color: #ef4444;
    }
    
    .progress-card {
      border-color: var(--theme-text);
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .toast-wrapper,
    .validation-errors,
    .progress-container,
    .loading-overlay {
      transition: none;
    }
  }
</style>