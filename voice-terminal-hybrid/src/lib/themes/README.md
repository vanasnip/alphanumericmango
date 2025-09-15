# Voice Terminal Hybrid - Theming System

This directory contains the core theming infrastructure for the voice-terminal-hybrid application, built with Svelte and Flowbite-Svelte integration.

## Overview

The theming system provides:
- VSCode-style JSON settings for themes
- Real-time reactive updates
- File watching for live changes
- CSS variable generation
- Theme validation and error reporting
- Import/export functionality
- Multiple theme presets

## Core Components

### 1. Theme Store (`/stores/theme.js`)
The main Svelte store that manages theme state and operations.

```javascript
import { themeStore, themeError, colors, typography } from '$lib/stores/theme.js';

// Subscribe to theme changes
themeStore.subscribe(theme => {
  console.log('Theme updated:', theme);
});

// Change theme mode
themeStore.setMode('dark');

// Apply a preset
themeStore.applyPreset('ocean');

// Update specific color
themeStore.setColor('primary', '#FF6B6B');
```

### 2. File Watcher (`/fileWatcher.js`)
Monitors `settings.json` for changes with debouncing and error handling.

```javascript
import { fileWatcher } from '$lib/fileWatcher.js';

// Watch a file (automatically used by theme store)
const cleanup = fileWatcher.watch('/settings.json', callback, 100);

// Stop watching
cleanup();
```

### 3. CSS Variable Generator (`/cssVariableGenerator.js`)
Converts JSON theme configuration to CSS custom properties.

```javascript
import { generateThemeCSS, updateThemeCSS } from '$lib/cssVariableGenerator.js';

// Generate CSS from theme
const css = generateThemeCSS(theme);

// Apply theme CSS to document
updateThemeCSS(theme);
```

### 4. Theme Validator (`/themeValidator.js`)
Validates theme configurations against JSON schema.

```javascript
import { validateTheme, formatValidationErrors } from '$lib/themeValidator.js';

const validation = validateTheme(theme);
if (!validation.isValid) {
  console.error(formatValidationErrors(validation.errors));
}
```

### 5. Theme Utilities (`/themeUtils.js`)
Provides utilities for theme manipulation, presets, and import/export.

```javascript
import { 
  getThemePresets, 
  exportTheme, 
  importTheme, 
  createThemeBackup 
} from '$lib/themeUtils.js';

// Get all available presets
const presets = getThemePresets();

// Export current theme
const json = exportTheme(currentTheme, true);

// Create backup
const backup = createThemeBackup(currentTheme, 'Before experiment');
```

## Theme Configuration

### Settings.json Structure

```json
{
  "theme": {
    "mode": "dark|light|auto",
    "preset": "default|ocean|forest|custom",
    "global": {
      "colors": {
        "primary": "#3B82F6",
        "secondary": "#8B5CF6",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "background": "#1F2937",
        "surface": "#374151",
        "text": "#F9FAFB"
      },
      "typography": {
        "fontFamily": "Inter, system-ui",
        "fontSize": {
          "base": "16px",
          "scale": 1.25
        }
      },
      "spacing": {
        "unit": "0.25rem",
        "scale": [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
      },
      "borders": {
        "radius": {
          "none": "0",
          "sm": "0.125rem",
          "md": "0.375rem",
          "lg": "0.5rem",
          "full": "9999px"
        },
        "width": "1px",
        "style": "solid"
      }
    },
    "components": {
      "terminal": {
        "inherit": false,
        "background": "#000000",
        "fontFamily": "JetBrains Mono, monospace",
        "fontSize": "14px",
        "lineHeight": 1.5,
        "padding": "1rem"
      },
      "voiceIndicator": {
        "inherit": true,
        "overrides": {
          "activeColor": "#10B981",
          "pulseAnimation": "2s ease-in-out infinite"
        }
      }
    }
  }
}
```

### Available Presets

1. **Default** - Standard dark theme with blue accents
2. **Ocean** - Dark theme with cyan/blue ocean colors
3. **Forest** - Dark theme with green nature colors

## Usage in Components

### Basic Theme Integration

```svelte
<script>
  import { themeStore, colors } from '$lib/stores/theme.js';
  
  // Subscribe to specific theme parts
  $: primaryColor = $colors.primary;
</script>

<div class="my-component" style="background: var(--theme-background)">
  <h1 style="color: var(--theme-primary)">Themed Heading</h1>
  <p style="color: var(--theme-text)">Themed text content</p>
</div>

<style>
  .my-component {
    padding: var(--spacing-4);
    border-radius: var(--rounded-lg);
    border: var(--theme-border-width) var(--theme-border-style) var(--theme-surface);
  }
</style>
```

### Flowbite Component Integration

```svelte
<script>
  import { Button, Card } from 'flowbite-svelte';
  import { themeStore } from '$lib/stores/theme.js';
</script>

<!-- Flowbite components automatically use the generated CSS variables -->
<Card class="themed-card">
  <Button color="primary">Themed Button</Button>
</Card>

<style>
  :global(.themed-card) {
    background-color: var(--theme-surface);
    border-color: var(--theme-primary);
  }
</style>
```

### Component-Specific Theming

```svelte
<script>
  import { terminalTheme, voiceIndicatorTheme } from '$lib/stores/theme.js';
</script>

<div class="terminal" style="
  background: {$terminalTheme.background};
  font-family: {$terminalTheme.fontFamily};
  font-size: {$terminalTheme.fontSize};
">
  Terminal content
</div>

<div class="voice-indicator" style="
  color: {$voiceIndicatorTheme.activeColor};
  animation: {$voiceIndicatorTheme.pulseAnimation};
">
  🎤
</div>
```

## CSS Variables Reference

### Global Variables
- `--theme-mode`: Current theme mode
- `--theme-preset`: Current preset name
- `--theme-primary`: Primary color
- `--theme-secondary`: Secondary color
- `--theme-success`: Success color
- `--theme-warning`: Warning color
- `--theme-error`: Error color
- `--theme-background`: Background color
- `--theme-surface`: Surface color
- `--theme-text`: Text color
- `--theme-font-family`: Font family
- `--theme-font-size-base`: Base font size
- `--theme-spacing-unit`: Spacing unit
- `--theme-border-radius-*`: Border radius values
- `--theme-border-width`: Border width
- `--theme-border-style`: Border style

### Flowbite Variables
- `--primary-50` to `--primary-900`: Primary color shades
- `--secondary-50` to `--secondary-900`: Secondary color shades
- `--gray-50` to `--gray-900`: Gray scale
- `--green-500`, `--yellow-500`, `--red-500`: Status colors
- `--spacing-*`: Spacing scale
- `--rounded-*`: Border radius scale

### Component Variables
- `--terminal-*`: Terminal-specific variables
- `--voice-indicator-*`: Voice indicator variables

## Error Handling

The theming system includes comprehensive error handling:

```svelte
<script>
  import { themeError } from '$lib/stores/theme.js';
</script>

{#if $themeError}
  <div class="error-banner">
    <h3>Theme Error:</h3>
    <pre>{$themeError}</pre>
  </div>
{/if}
```

## Performance Considerations

- Theme changes are debounced (100ms) to prevent excessive updates
- CSS variables are generated only when theme actually changes
- File watching uses efficient polling with proper cleanup
- Validation is performed before applying themes

## Development Tips

1. **Live Development**: Edit `settings.json` and see changes instantly
2. **Theme Export**: Use the demo component to export your custom themes
3. **Validation**: Check console for validation errors when developing themes
4. **Component Testing**: Use the ThemeDemo component to test theme integration
5. **Backup**: Create backups before experimenting with custom themes

## File Structure

```
src/lib/
├── stores/
│   └── theme.js                 # Main theme store
├── themes/
│   └── README.md               # This file
├── fileWatcher.js              # File watching utility
├── cssVariableGenerator.js     # CSS variable generation
├── themeValidator.js           # Theme validation
├── themeUtils.js              # Theme utilities
└── components/
    └── ThemeDemo.svelte        # Theme demonstration component
```

## Integration Checklist

- [ ] Import theme store in your components
- [ ] Use CSS variables in your styles
- [ ] Handle theme errors appropriately
- [ ] Test with different presets
- [ ] Validate custom theme configurations
- [ ] Implement responsive theme switching
- [ ] Test accessibility with different themes

For more detailed examples, see the `ThemeDemo.svelte` component.