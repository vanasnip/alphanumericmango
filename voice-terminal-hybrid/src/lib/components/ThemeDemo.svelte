<script>
  import { themeStore, themeError, colors, typography } from '$lib/stores/theme.js';
  import { Button, Input, Select, Card, Badge, Toast } from 'flowbite-svelte';
  
  // Theme control state
  let selectedPreset = 'default';
  let colorPickerValue = '#3B82F6';
  let showToast = false;
  let toastMessage = '';
  
  // Available presets
  const presets = themeStore.getPresets();
  const presetOptions = Object.keys(presets).map(key => ({ 
    value: key, 
    name: key.charAt(0).toUpperCase() + key.slice(1)
  }));
  
  // Color properties that can be changed
  const colorProperties = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'error', label: 'Error' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'text', label: 'Text' }
  ];
  
  let selectedColorProperty = 'primary';
  
  // Handle preset change
  function handlePresetChange() {
    themeStore.applyPreset(selectedPreset);
    showNotification(`Applied ${selectedPreset} preset`);
  }
  
  // Handle color change
  function handleColorChange() {
    themeStore.setColor(selectedColorProperty, colorPickerValue);
    showNotification(`Updated ${selectedColorProperty} color`);
  }
  
  // Show notification
  function showNotification(message) {
    toastMessage = message;
    showToast = true;
    setTimeout(() => {
      showToast = false;
    }, 3000);
  }
  
  // Export theme
  function exportTheme() {
    const themeJson = themeStore.export(true);
    const blob = new Blob([themeJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme.json';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Theme exported successfully');
  }
  
  // Import theme
  function importTheme(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const success = themeStore.import(e.target.result);
      if (success) {
        showNotification('Theme imported successfully');
      }
    };
    reader.readAsText(file);
  }
  
  // Reset theme
  function resetTheme() {
    themeStore.reset();
    selectedPreset = 'default';
    showNotification('Theme reset to default');
  }
</script>

<div class="theme-demo p-6 space-y-6">
  <Card class="theme-demo-card">
    <h2 class="text-2xl font-bold mb-4" style="color: var(--theme-text)">
      Theme Configuration Demo
    </h2>
    
    <!-- Error Display -->
    {#if $themeError}
      <div class="error-banner p-4 mb-4 rounded-lg" 
           style="background-color: var(--theme-error); color: white;">
        <h3 class="font-semibold mb-2">Theme Error:</h3>
        <pre class="whitespace-pre-wrap text-sm">{$themeError}</pre>
      </div>
    {/if}
    
    <!-- Preset Selection -->
    <div class="preset-section mb-6">
      <h3 class="text-lg font-semibold mb-3" style="color: var(--theme-text)">
        Theme Presets
      </h3>
      <div class="flex gap-4 items-center">
        <Select bind:value={selectedPreset} items={presetOptions} />
        <Button on:click={handlePresetChange} color="primary">
          Apply Preset
        </Button>
      </div>
    </div>
    
    <!-- Color Customization -->
    <div class="color-section mb-6">
      <h3 class="text-lg font-semibold mb-3" style="color: var(--theme-text)">
        Color Customization
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Select 
            bind:value={selectedColorProperty} 
            items={colorProperties.map(c => ({ value: c.key, name: c.label }))} 
          />
        </div>
        <div class="flex gap-2">
          <Input 
            type="color" 
            bind:value={colorPickerValue}
            class="w-20"
          />
          <Button on:click={handleColorChange} color="secondary" size="sm">
            Update
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Theme Actions -->
    <div class="actions-section mb-6">
      <h3 class="text-lg font-semibold mb-3" style="color: var(--theme-text)">
        Theme Management
      </h3>
      <div class="flex flex-wrap gap-3">
        <Button on:click={exportTheme} color="green">
          Export Theme
        </Button>
        <label class="btn-file">
          <Button color="blue">Import Theme</Button>
          <input 
            type="file" 
            accept=".json" 
            on:change={importTheme}
            class="hidden"
          />
        </label>
        <Button on:click={resetTheme} color="red">
          Reset to Default
        </Button>
      </div>
    </div>
    
    <!-- Live Preview -->
    <div class="preview-section">
      <h3 class="text-lg font-semibold mb-3" style="color: var(--theme-text)">
        Live Preview
      </h3>
      <div class="preview-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Color Swatches -->
        <Card class="color-swatches">
          <h4 class="font-medium mb-3">Colors</h4>
          <div class="space-y-2">
            {#each colorProperties as { key, label }}
              <div class="flex items-center gap-3">
                <div 
                  class="w-6 h-6 rounded border"
                  style="background-color: var(--theme-{key})"
                ></div>
                <span class="text-sm" style="color: var(--theme-text)">
                  {label}
                </span>
              </div>
            {/each}
          </div>
        </Card>
        
        <!-- Typography -->
        <Card class="typography-demo">
          <h4 class="font-medium mb-3">Typography</h4>
          <div class="space-y-2" style="font-family: var(--theme-font-family)">
            <p class="text-xl" style="color: var(--theme-text)">
              Heading Text
            </p>
            <p class="text-base" style="color: var(--theme-text)">
              Body text with custom font family
            </p>
            <p class="text-sm opacity-75" style="color: var(--theme-text)">
              Small text for labels
            </p>
          </div>
        </Card>
        
        <!-- Components -->
        <Card class="components-demo">
          <h4 class="font-medium mb-3">Components</h4>
          <div class="space-y-3">
            <Button color="primary" size="sm">Primary Button</Button>
            <Button color="secondary" size="sm">Secondary Button</Button>
            <Badge color="green">Success Badge</Badge>
            <Badge color="yellow">Warning Badge</Badge>
            <Badge color="red">Error Badge</Badge>
          </div>
        </Card>
      </div>
    </div>
  </Card>
  
  <!-- Toast Notification -->
  {#if showToast}
    <Toast color="green" class="fixed bottom-4 right-4">
      {toastMessage}
    </Toast>
  {/if}
</div>

<style>
  .theme-demo {
    background-color: var(--theme-background);
    color: var(--theme-text);
    min-height: 100vh;
  }
  
  .theme-demo-card {
    background-color: var(--theme-surface);
    border: 1px solid color-mix(in srgb, var(--theme-text) 20%, transparent);
  }
  
  .color-swatches,
  .typography-demo,
  .components-demo {
    background-color: var(--theme-background);
    border: 1px solid color-mix(in srgb, var(--theme-text) 10%, transparent);
  }
  
  .error-banner {
    border: 1px solid var(--theme-error);
  }
  
  .btn-file {
    position: relative;
    display: inline-block;
  }
  
  .preview-grid {
    gap: 1rem;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .preview-grid {
      grid-template-columns: 1fr;
    }
  }
</style>