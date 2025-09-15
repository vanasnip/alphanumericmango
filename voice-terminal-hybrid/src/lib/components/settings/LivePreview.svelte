<script>
  import { createEventDispatcher } from 'svelte';
  import { 
    Button, 
    Card, 
    Badge, 
    Input, 
    Select, 
    Toggle, 
    Tooltip,
    ButtonGroup,
    Range,
    Tabs,
    TabItem
  } from 'flowbite-svelte';
  import { 
    EyeOutline,
    EyeSlashOutline,
    SunOutline,
    MoonOutline,
    AdjustmentsHorizontalOutline,
    SplitCellsOutline,
    GridOutline,
    ViewColumnsOutline,
    ArrowsPointingOutOutline,
    ArrowsPointingInOutline
  } from 'flowbite-svelte-icons';

  const dispatch = createEventDispatcher();

  // Props
  export let theme = null;
  export let compareTheme = null;
  export let showComparison = false;
  export let collapsed = false;

  // Preview state
  let viewMode = 'grid'; // 'grid', 'list', 'comparison'
  let componentStates = {
    buttons: 'default', // 'default', 'hover', 'active', 'disabled', 'focus'
    inputs: 'default',
    cards: 'default',
    badges: 'default'
  };
  
  let previewScale = 1;
  let showStates = true;
  let autoRefresh = true;
  let fullscreen = false;

  // Component showcase data
  const showcaseComponents = [
    {
      id: 'buttons',
      label: 'Buttons',
      category: 'Interactive',
      states: ['default', 'hover', 'active', 'disabled', 'focus']
    },
    {
      id: 'inputs',
      label: 'Inputs',
      category: 'Forms',
      states: ['default', 'focus', 'error', 'disabled']
    },
    {
      id: 'cards',
      label: 'Cards',
      category: 'Layout',
      states: ['default', 'hover', 'elevated']
    },
    {
      id: 'badges',
      label: 'Badges',
      category: 'Data',
      states: ['default', 'outline', 'pill']
    },
    {
      id: 'navigation',
      label: 'Navigation',
      category: 'Navigation',
      states: ['default', 'active', 'disabled']
    },
    {
      id: 'feedback',
      label: 'Feedback',
      category: 'Communication',
      states: ['success', 'warning', 'error', 'info']
    }
  ];

  // Color swatches from theme
  $: colorSwatches = theme ? Object.entries(theme.global?.colors || {}) : [];
  $: typography = theme?.global?.typography || {};
  
  function toggleViewMode() {
    const modes = ['grid', 'list', 'comparison'];
    const currentIndex = modes.indexOf(viewMode);
    viewMode = modes[(currentIndex + 1) % modes.length];
  }

  function updateComponentState(componentId, state) {
    componentStates[componentId] = state;
    componentStates = { ...componentStates };
    dispatch('stateChange', { component: componentId, state });
  }

  function resetAllStates() {
    Object.keys(componentStates).forEach(key => {
      componentStates[key] = 'default';
    });
    componentStates = { ...componentStates };
    dispatch('reset');
  }

  function exportPreview() {
    dispatch('export', {
      theme,
      componentStates,
      viewMode,
      timestamp: new Date().toISOString()
    });
  }

  function toggleFullscreen() {
    fullscreen = !fullscreen;
    dispatch('fullscreen', { fullscreen });
  }
</script>

<div class="live-preview" class:collapsed class:fullscreen>
  <!-- Preview Header -->
  <div class="preview-header">
    <div class="header-left">
      <h3 class="preview-title">
        {#if collapsed}
          <EyeOutline class="w-5 h-5" />
        {:else}
          Live Preview
        {/if}
      </h3>
      
      {#if !collapsed}
        <div class="view-controls">
          <ButtonGroup>
            <Button
              size="xs"
              color={viewMode === 'grid' ? 'primary' : 'ghost'}
              on:click={() => viewMode = 'grid'}
            >
              <GridOutline class="w-4 h-4" />
            </Button>
            <Button
              size="xs"
              color={viewMode === 'list' ? 'primary' : 'ghost'}
              on:click={() => viewMode = 'list'}
            >
              <ViewColumnsOutline class="w-4 h-4" />
            </Button>
            <Button
              size="xs"
              color={viewMode === 'comparison' ? 'primary' : 'ghost'}
              on:click={() => viewMode = 'comparison'}
            >
              <SplitCellsOutline class="w-4 h-4" />
            </Button>
          </ButtonGroup>
        </div>
      {/if}
    </div>

    {#if !collapsed}
      <div class="header-right">
        <div class="preview-controls">
          <!-- Scale Control -->
          <div class="scale-control">
            <span class="control-label">Scale:</span>
            <Range
              min="0.5"
              max="2"
              step="0.1"
              bind:value={previewScale}
              class="scale-slider"
            />
            <span class="scale-value">{Math.round(previewScale * 100)}%</span>
          </div>

          <!-- Options -->
          <Toggle bind:checked={showStates} size="sm">
            States
          </Toggle>
          
          <Toggle bind:checked={autoRefresh} size="sm">
            Auto
          </Toggle>

          <!-- Actions -->
          <Tooltip content="Toggle fullscreen">
            <Button
              size="xs"
              color="ghost"
              on:click={toggleFullscreen}
            >
              {#if fullscreen}
                <ArrowsPointingInOutline class="w-4 h-4" />
              {:else}
                <ArrowsPointingOutOutline class="w-4 h-4" />
              {/if}
            </Button>
          </Tooltip>

          <Tooltip content="Reset all states">
            <Button
              size="xs"
              color="ghost"
              on:click={resetAllStates}
            >
              Reset
            </Button>
          </Tooltip>
        </div>
      </div>
    {/if}
  </div>

  <!-- Preview Content -->
  {#if !collapsed}
    <div class="preview-content" style="transform: scale({previewScale})">
      {#if viewMode === 'comparison' && compareTheme}
        <!-- Comparison View -->
        <div class="comparison-view">
          <div class="comparison-panel">
            <h4 class="comparison-title">Current Theme</h4>
            <div class="comparison-content" data-theme="current">
              {#each showcaseComponents as component}
                <div class="component-showcase">
                  <h5 class="component-title">{component.label}</h5>
                  <div class="component-preview">
                    {#if component.id === 'buttons'}
                      <div class="button-group">
                        <Button color="primary" size="sm">Primary</Button>
                        <Button color="secondary" size="sm">Secondary</Button>
                        <Button color="success" size="sm">Success</Button>
                        <Button color="red" size="sm">Error</Button>
                      </div>
                    {:else if component.id === 'inputs'}
                      <div class="input-group">
                        <Input placeholder="Text input" size="sm" />
                        <Select items={[{value: '1', name: 'Option 1'}]} size="sm" />
                      </div>
                    {:else if component.id === 'cards'}
                      <Card class="sample-card" size="sm">
                        <h6>Card Title</h6>
                        <p>Card content with theme colors.</p>
                      </Card>
                    {:else if component.id === 'badges'}
                      <div class="badge-group">
                        <Badge color="primary">Primary</Badge>
                        <Badge color="green">Success</Badge>
                        <Badge color="red">Error</Badge>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="comparison-divider"></div>

          <div class="comparison-panel">
            <h4 class="comparison-title">Compare Theme</h4>
            <div class="comparison-content" data-theme="compare">
              {#each showcaseComponents as component}
                <div class="component-showcase">
                  <h5 class="component-title">{component.label}</h5>
                  <div class="component-preview">
                    {#if component.id === 'buttons'}
                      <div class="button-group">
                        <Button color="primary" size="sm">Primary</Button>
                        <Button color="secondary" size="sm">Secondary</Button>
                        <Button color="success" size="sm">Success</Button>
                        <Button color="red" size="sm">Error</Button>
                      </div>
                    {:else if component.id === 'inputs'}
                      <div class="input-group">
                        <Input placeholder="Text input" size="sm" />
                        <Select items={[{value: '1', name: 'Option 1'}]} size="sm" />
                      </div>
                    {:else if component.id === 'cards'}
                      <Card class="sample-card" size="sm">
                        <h6>Card Title</h6>
                        <p>Card content with theme colors.</p>
                      </Card>
                    {:else if component.id === 'badges'}
                      <div class="badge-group">
                        <Badge color="primary">Primary</Badge>
                        <Badge color="green">Success</Badge>
                        <Badge color="red">Error</Badge>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <!-- Single Theme View -->
        <div class="single-view">
          <!-- Color Palette -->
          <Card class="color-palette-card">
            <div class="card-header">
              <h4>Color Palette</h4>
            </div>
            <div class="color-grid">
              {#each colorSwatches as [name, color]}
                <div class="color-swatch">
                  <div 
                    class="color-preview" 
                    style="background-color: {color}"
                    title="{name}: {color}"
                  ></div>
                  <div class="color-info">
                    <span class="color-name">{name}</span>
                    <span class="color-value">{color}</span>
                  </div>
                </div>
              {/each}
            </div>
          </Card>

          <!-- Typography -->
          <Card class="typography-card">
            <div class="card-header">
              <h4>Typography</h4>
            </div>
            <div class="typography-samples">
              <div class="font-sample" style="font-family: {typography.fontFamily}">
                <h1>Heading 1</h1>
                <h2>Heading 2</h2>
                <h3>Heading 3</h3>
                <p>Body text with custom font family and styling.</p>
                <small>Small text for captions and labels.</small>
              </div>
            </div>
          </Card>

          <!-- Component Showcase -->
          <div class="component-showcase-grid" class:list-view={viewMode === 'list'}>
            {#each showcaseComponents as component}
              <Card class="component-card">
                <div class="card-header">
                  <h5>{component.label}</h5>
                  <Badge size="sm" color="blue">{component.category}</Badge>
                  
                  {#if showStates}
                    <Select 
                      size="sm"
                      bind:value={componentStates[component.id]}
                      items={component.states.map(s => ({value: s, name: s}))}
                      on:change={(e) => updateComponentState(component.id, e.target.value)}
                    />
                  {/if}
                </div>

                <div class="component-demo" data-state={componentStates[component.id]}>
                  {#if component.id === 'buttons'}
                    <div class="demo-buttons">
                      <Button 
                        color="primary" 
                        size="sm"
                        disabled={componentStates.buttons === 'disabled'}
                        class={componentStates.buttons === 'hover' ? 'hover' : ''}
                      >
                        Primary
                      </Button>
                      <Button 
                        color="secondary" 
                        size="sm"
                        disabled={componentStates.buttons === 'disabled'}
                      >
                        Secondary
                      </Button>
                      <Button 
                        color="success" 
                        size="sm"
                        disabled={componentStates.buttons === 'disabled'}
                      >
                        Success
                      </Button>
                      <Button 
                        color="red" 
                        size="sm"
                        disabled={componentStates.buttons === 'disabled'}
                      >
                        Error
                      </Button>
                    </div>
                  {:else if component.id === 'inputs'}
                    <div class="demo-inputs">
                      <Input 
                        placeholder="Text input" 
                        size="sm"
                        disabled={componentStates.inputs === 'disabled'}
                        color={componentStates.inputs === 'error' ? 'red' : 'base'}
                      />
                      <Select 
                        items={[
                          {value: '1', name: 'Option 1'},
                          {value: '2', name: 'Option 2'},
                          {value: '3', name: 'Option 3'}
                        ]} 
                        size="sm"
                        disabled={componentStates.inputs === 'disabled'}
                      />
                      <Input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value="50"
                        disabled={componentStates.inputs === 'disabled'}
                      />
                    </div>
                  {:else if component.id === 'cards'}
                    <div class="demo-cards">
                      <Card 
                        size="sm" 
                        class={componentStates.cards === 'elevated' ? 'elevated' : ''}
                      >
                        <h6>Sample Card</h6>
                        <p>This is a sample card with theme styling applied.</p>
                        <div class="card-actions">
                          <Button size="xs" color="primary">Action</Button>
                          <Button size="xs" color="ghost">Cancel</Button>
                        </div>
                      </Card>
                    </div>
                  {:else if component.id === 'badges'}
                    <div class="demo-badges">
                      <Badge color="primary">Primary</Badge>
                      <Badge color="green">Success</Badge>
                      <Badge color="yellow">Warning</Badge>
                      <Badge color="red">Error</Badge>
                      <Badge color="blue">Info</Badge>
                    </div>
                  {:else if component.id === 'navigation'}
                    <div class="demo-navigation">
                      <Tabs style="underline">
                        <TabItem open title="Active">
                          <p>Active tab content</p>
                        </TabItem>
                        <TabItem title="Tab 2">
                          <p>Tab 2 content</p>
                        </TabItem>
                        <TabItem title="Disabled" disabled>
                          <p>Disabled tab</p>
                        </TabItem>
                      </Tabs>
                    </div>
                  {:else if component.id === 'feedback'}
                    <div class="demo-feedback">
                      <div class="feedback-item success">
                        <Badge color="green">Success</Badge>
                        <span>Operation completed successfully</span>
                      </div>
                      <div class="feedback-item warning">
                        <Badge color="yellow">Warning</Badge>
                        <span>Please check your input</span>
                      </div>
                      <div class="feedback-item error">
                        <Badge color="red">Error</Badge>
                        <span>Something went wrong</span>
                      </div>
                    </div>
                  {/if}
                </div>
              </Card>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .live-preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--theme-background);
    overflow: hidden;
  }

  .live-preview.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    background-color: var(--theme-background);
  }

  .live-preview.collapsed {
    min-width: 60px;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--theme-surface);
    border-bottom: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
    gap: 1rem;
  }

  .collapsed .preview-header {
    justify-content: center;
    padding: 1rem 0.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .preview-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .view-controls {
    display: flex;
    gap: 0.5rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .preview-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .scale-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .control-label {
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
  }

  .scale-slider {
    width: 80px;
  }

  .scale-value {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    min-width: 3rem;
    text-align: right;
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    transform-origin: top left;
  }

  .comparison-view {
    display: flex;
    height: 100%;
    gap: 1rem;
  }

  .comparison-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .comparison-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
    text-align: center;
  }

  .comparison-content {
    flex: 1;
    overflow: auto;
  }

  .comparison-divider {
    width: 2px;
    background-color: color-mix(in srgb, var(--theme-text) 20%, transparent);
    border-radius: 1px;
  }

  .single-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .color-palette-card,
  .typography-card {
    background-color: var(--theme-surface);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .card-header h4,
  .card-header h5 {
    margin: 0;
    font-weight: 600;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 1rem;
  }

  .color-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .color-preview {
    width: 100%;
    height: 3rem;
    border-radius: 0.375rem;
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
    cursor: pointer;
    transition: transform 0.2s;
  }

  .color-preview:hover {
    transform: scale(1.05);
  }

  .color-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    text-align: center;
  }

  .color-name {
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .color-value {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: color-mix(in srgb, var(--theme-text) 70%, transparent);
  }

  .typography-samples {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .font-sample {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .font-sample h1,
  .font-sample h2,
  .font-sample h3 {
    margin: 0;
    color: var(--theme-text);
  }

  .component-showcase-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .component-showcase-grid.list-view {
    grid-template-columns: 1fr;
  }

  .component-card {
    background-color: var(--theme-surface);
  }

  .component-demo {
    padding: 1rem;
    background-color: var(--theme-background);
    border-radius: 0.375rem;
    border: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
  }

  .demo-buttons,
  .demo-badges,
  .demo-inputs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .demo-cards {
    max-width: 250px;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .demo-feedback {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .feedback-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    background-color: color-mix(in srgb, var(--theme-surface) 50%, transparent);
  }

  .component-showcase {
    margin-bottom: 1.5rem;
  }

  .component-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--theme-text);
  }

  .component-preview {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .preview-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .header-right {
      justify-content: space-between;
    }

    .preview-controls {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .comparison-view {
      flex-direction: column;
    }

    .comparison-divider {
      height: 2px;
      width: 100%;
    }

    .color-grid {
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    }

    .component-showcase-grid {
      grid-template-columns: 1fr;
    }
  }

  /* State Variations */
  .component-demo[data-state="hover"] .demo-buttons button:not(:disabled):hover,
  .component-demo[data-state="hover"] .demo-inputs input:hover {
    /* Hover state styles would be applied here */
  }

  .component-demo[data-state="focus"] .demo-inputs input {
    outline: 2px solid var(--theme-primary);
    outline-offset: 2px;
  }

  .elevated {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .color-preview,
    .component-demo {
      border-color: var(--theme-text);
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .color-preview,
    .preview-content {
      transition: none;
    }
  }
</style>