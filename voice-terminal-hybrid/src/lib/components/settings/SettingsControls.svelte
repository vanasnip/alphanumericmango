<script>
  import { createEventDispatcher } from 'svelte';
  import { 
    Button, 
    Select, 
    Input, 
    ButtonGroup, 
    Dropdown, 
    DropdownItem,
    Tooltip,
    Badge,
    Toggle,
    Kbd
  } from 'flowbite-svelte';
  import { 
    SearchOutline,
    DownloadOutline,
    UploadOutline,
    TrashBinOutline,
    ArrowUturnLeftOutline,
    ArrowUturnRightOutline,
    CogOutline,
    SunOutline,
    MoonOutline,
    ComputerDesktopOutline,
    BookmarkOutline,
    PlusOutline,
    EllipsisVerticalOutline,
    CheckOutline,
    XMarkOutline,
    DocumentDuplicateOutline
  } from 'flowbite-svelte-icons';

  const dispatch = createEventDispatcher();

  // Props
  export let presets = [];
  export let selectedPreset = 'default';
  export let canUndo = false;
  export let canRedo = false;
  export let hasUnsavedChanges = false;
  export let isLoading = false;
  export let collapsed = false;
  export let searchEnabled = true;

  // Local state
  let searchQuery = '';
  let searchResults = [];
  let darkMode = false;
  let showAdvanced = false;
  let customPresetName = '';
  let showCreatePreset = false;

  // Preset options for Select component
  $: presetOptions = presets.map(preset => ({
    value: preset.id,
    name: preset.name,
    disabled: preset.disabled || false
  }));

  // Search functionality
  let searchDebounceTimeout;
  function handleSearch() {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      if (searchQuery.trim()) {
        dispatch('search', { query: searchQuery.trim() });
      } else {
        dispatch('clearSearch');
      }
    }, 300);
  }

  // Preset management
  function selectPreset(presetId) {
    selectedPreset = presetId;
    dispatch('presetChange', { preset: presetId });
  }

  function createCustomPreset() {
    if (customPresetName.trim()) {
      dispatch('createPreset', { 
        name: customPresetName.trim(),
        basedOn: selectedPreset 
      });
      customPresetName = '';
      showCreatePreset = false;
    }
  }

  function deletePreset(presetId) {
    dispatch('deletePreset', { preset: presetId });
  }

  function duplicatePreset(presetId) {
    dispatch('duplicatePreset', { preset: presetId });
  }

  // Theme actions
  function exportTheme() {
    dispatch('export');
  }

  function importTheme(event) {
    const file = event.target.files[0];
    if (file) {
      dispatch('import', { file });
    }
  }

  function saveTheme() {
    dispatch('save');
  }

  function resetTheme() {
    dispatch('reset');
  }

  // Undo/Redo
  function undo() {
    if (canUndo) {
      dispatch('undo');
    }
  }

  function redo() {
    if (canRedo) {
      dispatch('redo');
    }
  }

  // Theme mode toggle
  function toggleThemeMode() {
    darkMode = !darkMode;
    dispatch('modeChange', { mode: darkMode ? 'dark' : 'light' });
  }

  // Keyboard shortcuts
  function handleKeydown(event) {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          saveTheme();
          break;
        case 'z':
          if (event.shiftKey) {
            event.preventDefault();
            redo();
          } else {
            event.preventDefault();
            undo();
          }
          break;
        case 'f':
          event.preventDefault();
          document.querySelector('.search-input')?.focus();
          break;
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="settings-controls" class:collapsed>
  {#if collapsed}
    <!-- Collapsed View -->
    <div class="collapsed-controls">
      <Tooltip content="Theme presets">
        <Button size="sm" color="ghost">
          <BookmarkOutline class="w-4 h-4" />
        </Button>
      </Tooltip>
      
      <Tooltip content="Search">
        <Button size="sm" color="ghost">
          <SearchOutline class="w-4 h-4" />
        </Button>
      </Tooltip>
      
      <Tooltip content="Settings">
        <Button size="sm" color="ghost">
          <CogOutline class="w-4 h-4" />
        </Button>
      </Tooltip>
    </div>
  {:else}
    <!-- Expanded View -->
    <div class="expanded-controls">
      <!-- Search Section -->
      {#if searchEnabled}
        <div class="control-section">
          <h4 class="section-title">Search</h4>
          <div class="search-container">
            <Input
              class="search-input"
              placeholder="Search theme properties..."
              bind:value={searchQuery}
              on:input={handleSearch}
              size="sm"
            >
              <SearchOutline slot="left" class="w-4 h-4" />
              {#if searchQuery}
                <Button
                  slot="right"
                  size="xs"
                  color="ghost"
                  on:click={() => { searchQuery = ''; handleSearch(); }}
                >
                  <XMarkOutline class="w-3 h-3" />
                </Button>
              {/if}
            </Input>
            
            {#if searchQuery}
              <div class="search-info">
                <Kbd class="keyboard-shortcut">⌘K</Kbd>
                <span class="search-hint">to focus search</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Theme Presets Section -->
      <div class="control-section">
        <div class="section-header">
          <h4 class="section-title">Theme Presets</h4>
          <div class="section-actions">
            <Tooltip content="Create new preset">
              <Button
                size="xs"
                color="ghost"
                on:click={() => showCreatePreset = !showCreatePreset}
              >
                <PlusOutline class="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <!-- Create Preset Form -->
        {#if showCreatePreset}
          <div class="create-preset-form">
            <Input
              placeholder="Preset name"
              bind:value={customPresetName}
              size="sm"
              on:keydown={(e) => e.key === 'Enter' && createCustomPreset()}
            />
            <div class="form-actions">
              <Button size="xs" color="primary" on:click={createCustomPreset}>
                <CheckOutline class="w-3 h-3" />
              </Button>
              <Button 
                size="xs" 
                color="ghost" 
                on:click={() => showCreatePreset = false}
              >
                <XMarkOutline class="w-3 h-3" />
              </Button>
            </div>
          </div>
        {/if}

        <!-- Preset Selector -->
        <div class="preset-selector">
          <Select
            bind:value={selectedPreset}
            items={presetOptions}
            on:change={(e) => selectPreset(e.target.value)}
            size="sm"
          />
          
          {#if selectedPreset !== 'default'}
            <Dropdown class="preset-menu">
              <Button slot="trigger" size="xs" color="ghost">
                <EllipsisVerticalOutline class="w-4 h-4" />
              </Button>
              
              <DropdownItem on:click={() => duplicatePreset(selectedPreset)}>
                <DocumentDuplicateOutline class="w-4 h-4 mr-2" />
                Duplicate
              </DropdownItem>
              
              <DropdownItem 
                on:click={() => deletePreset(selectedPreset)}
                class="text-red-600"
              >
                <TrashBinOutline class="w-4 h-4 mr-2" />
                Delete
              </DropdownItem>
            </Dropdown>
          {/if}
        </div>

        <!-- Preset Quick Actions -->
        <div class="preset-badges">
          {#each presets.slice(0, 4) as preset}
            <Button
              size="xs"
              color={selectedPreset === preset.id ? 'primary' : 'ghost'}
              on:click={() => selectPreset(preset.id)}
              class="preset-badge"
            >
              {preset.name}
              {#if preset.id === selectedPreset}
                <CheckOutline class="w-3 h-3 ml-1" />
              {/if}
            </Button>
          {/each}
        </div>
      </div>

      <!-- Theme Actions Section -->
      <div class="control-section">
        <h4 class="section-title">Actions</h4>
        
        <!-- Undo/Redo -->
        <div class="action-group">
          <h5 class="group-title">History</h5>
          <ButtonGroup>
            <Tooltip content="Undo (⌘Z)">
              <Button
                size="sm"
                color="ghost"
                disabled={!canUndo}
                on:click={undo}
              >
                <ArrowUturnLeftOutline class="w-4 h-4" />
              </Button>
            </Tooltip>
            
            <Tooltip content="Redo (⌘⇧Z)">
              <Button
                size="sm"
                color="ghost"
                disabled={!canRedo}
                on:click={redo}
              >
                <ArrowUturnRightOutline class="w-4 h-4" />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>

        <!-- Save/Load -->
        <div class="action-group">
          <h5 class="group-title">File Operations</h5>
          <div class="action-buttons">
            <Button
              size="sm"
              color="primary"
              on:click={saveTheme}
              disabled={!hasUnsavedChanges || isLoading}
              class="save-button"
            >
              {#if isLoading}
                <div class="loading-spinner"></div>
                Saving...
              {:else}
                Save
                {#if hasUnsavedChanges}
                  <Badge size="xs" class="unsaved-indicator">•</Badge>
                {/if}
              {/if}
            </Button>

            <Button
              size="sm"
              color="green"
              on:click={exportTheme}
            >
              <DownloadOutline class="w-4 h-4 mr-1" />
              Export
            </Button>

            <label class="import-button">
              <Button size="sm" color="blue">
                <UploadOutline class="w-4 h-4 mr-1" />
                Import
              </Button>
              <input
                type="file"
                accept=".json"
                on:change={importTheme}
                class="hidden"
              />
            </label>

            <Button
              size="sm"
              color="red"
              on:click={resetTheme}
            >
              <TrashBinOutline class="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <!-- Display Settings Section -->
      <div class="control-section">
        <h4 class="section-title">Display</h4>
        
        <!-- Dark Mode Toggle -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Dark Mode</span>
            <span class="setting-description">Toggle light/dark interface</span>
          </div>
          <Toggle
            bind:checked={darkMode}
            on:change={toggleThemeMode}
            size="sm"
          >
            {#if darkMode}
              <MoonOutline class="w-4 h-4" />
            {:else}
              <SunOutline class="w-4 h-4" />
            {/if}
          </Toggle>
        </div>

        <!-- Advanced Settings Toggle -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Advanced Mode</span>
            <span class="setting-description">Show advanced options</span>
          </div>
          <Toggle
            bind:checked={showAdvanced}
            size="sm"
          />
        </div>

        {#if showAdvanced}
          <div class="advanced-settings">
            <div class="setting-item">
              <span class="setting-label">Auto-save</span>
              <Toggle size="sm" checked />
            </div>
            
            <div class="setting-item">
              <span class="setting-label">Live preview</span>
              <Toggle size="sm" checked />
            </div>
            
            <div class="setting-item">
              <span class="setting-label">Validation</span>
              <Toggle size="sm" checked />
            </div>
          </div>
        {/if}
      </div>

      <!-- Keyboard Shortcuts Section -->
      <div class="control-section">
        <h4 class="section-title">Shortcuts</h4>
        <div class="shortcuts-list">
          <div class="shortcut-item">
            <Kbd>⌘S</Kbd>
            <span>Save theme</span>
          </div>
          <div class="shortcut-item">
            <Kbd>⌘Z</Kbd>
            <span>Undo</span>
          </div>
          <div class="shortcut-item">
            <Kbd>⌘⇧Z</Kbd>
            <span>Redo</span>
          </div>
          <div class="shortcut-item">
            <Kbd>⌘F</Kbd>
            <span>Search</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-controls {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--theme-background);
    overflow-y: auto;
  }

  .settings-controls.collapsed {
    align-items: center;
    padding: 1rem 0.5rem;
  }

  .collapsed-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .expanded-controls {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-actions {
    display: flex;
    gap: 0.25rem;
  }

  .search-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--theme-text) 60%, transparent);
  }

  .keyboard-shortcut {
    font-size: 0.625rem;
  }

  .search-hint {
    font-style: italic;
  }

  .create-preset-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .form-actions {
    display: flex;
    gap: 0.25rem;
  }

  .preset-selector {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .preset-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .preset-badge {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
  }

  .action-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .group-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .save-button {
    position: relative;
  }

  .unsaved-indicator {
    color: #ef4444;
    background: transparent;
    font-size: 1rem;
    line-height: 1;
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .import-button {
    position: relative;
    display: inline-block;
  }

  .hidden {
    display: none;
  }

  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
  }

  .setting-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-text);
  }

  .setting-description {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--theme-text) 60%, transparent);
  }

  .advanced-settings {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: color-mix(in srgb, var(--theme-surface) 50%, transparent);
    border-radius: 0.375rem;
    border: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.75rem;
  }

  .shortcut-item span {
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .expanded-controls {
      padding: 0.75rem;
      gap: 1rem;
    }

    .action-buttons {
      grid-template-columns: 1fr;
    }

    .preset-badges {
      flex-direction: column;
    }

    .setting-item {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .setting-info {
      text-align: center;
    }
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .advanced-settings {
      border-color: var(--theme-text);
    }
  }

  /* Focus States */
  .preset-badge:focus,
  .save-button:focus {
    outline: 2px solid var(--theme-primary);
    outline-offset: 2px;
  }
</style>