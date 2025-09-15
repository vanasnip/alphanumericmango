# Flowbite-Svelte UI Transformation Style Guide

## Core Principles
1. **JSON-First Configuration**: All theming controlled via settings.json
2. **Component Modularity**: Each component themeable independently
3. **Reactive Updates**: Real-time theme changes without restart
4. **Accessibility by Default**: WCAG 2.1 AA compliance minimum
5. **Performance Conscious**: Theme switching < 100ms

## Theme Architecture

### JSON Schema Structure
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

## Flowbite Component Integration

### Base Components Used
- **Navigation**: Navbar, Sidebar (customized for voice commands)
- **Forms**: Input, Select, Toggle (for settings)
- **Feedback**: Toast, Modal (for voice feedback)
- **Data Display**: Card, Badge (for terminal output)
- **Indicators**: Progress, Spinner (for voice processing)

### Customization Pattern
```svelte
<script>
  import { Button } from 'flowbite-svelte';
  import { themeStore } from '$lib/stores/theme';
  
  $: buttonTheme = $themeStore.components.button || $themeStore.global;
</script>

<Button 
  color="primary"
  style="--btn-bg: {buttonTheme.colors.primary}"
/>
```

## CSS Variable Mapping

### Global Variables
```css
:root {
  /* Colors */
  --color-primary: var(--theme-primary);
  --color-background: var(--theme-background);
  
  /* Typography */
  --font-family: var(--theme-font-family);
  --font-size-base: var(--theme-font-size);
  
  /* Spacing */
  --spacing-unit: var(--theme-spacing-unit);
  
  /* Borders */
  --border-radius: var(--theme-border-radius);
}
```

### Component Scoping
```css
.terminal {
  background: var(--terminal-bg, var(--color-background));
  font-family: var(--terminal-font, var(--font-family));
}
```

## Voice UI Patterns

### Visual Feedback States
1. **Idle**: Subtle pulse animation
2. **Listening**: Prominent glow effect
3. **Processing**: Loading spinner
4. **Speaking**: Waveform animation
5. **Error**: Red pulse with message

### Accessibility Requirements
- Keyboard navigation for all controls
- Screen reader announcements for voice state
- High contrast mode support
- Focus indicators visible
- Motion preferences respected

## Testing Checklist

### Theme Validation
- [ ] JSON schema validation on save
- [ ] CSS variable generation accuracy
- [ ] Component inheritance rules
- [ ] Override precedence
- [ ] Performance benchmarks

### Visual Regression
- [ ] Screenshot comparison for theme presets
- [ ] Component state variations
- [ ] Responsive breakpoints
- [ ] Browser compatibility

## Team Collaboration Points

### Handoff Protocol
1. **UX → UI**: User flows and interaction specs
2. **UI → Frontend**: Component designs and theme tokens
3. **Frontend → QA**: Implementation and test scenarios
4. **QA → All**: Bug reports and validation results

### File Organization
```
voice-terminal-hybrid/
├── src/
│   ├── lib/
│   │   ├── stores/
│   │   │   └── theme.js
│   │   ├── themes/
│   │   │   ├── presets/
│   │   │   └── schema.json
│   │   └── components/
│   │       └── themed/
│   └── app.css
├── settings.json
└── STYLE_GUIDE.md
```

## Success Metrics
- Theme switch performance < 100ms
- Zero accessibility violations
- 100% Flowbite component coverage
- Settings validation error rate < 1%
- User satisfaction score > 4.5/5