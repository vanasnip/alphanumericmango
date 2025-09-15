# Voice Terminal Hybrid - Theme System Documentation

## Overview

The Voice Terminal Hybrid theme system provides a comprehensive, JSON-driven approach to theming with Flowbite-Svelte components. It includes 4 complete theme presets, voice UI visual feedback states, and full component customization support.

## 🎨 Theme Presets

### 1. Default Theme
**Classic Flowbite-based terminal aesthetic**

#### Dark Mode
- **Primary**: `#3B82F6` (Blue)
- **Secondary**: `#8B5CF6` (Purple)
- **Background**: `#0F172A` (Dark Slate)
- **Surface**: `#1E293B` (Slate)
- **Text**: `#F8FAFC` (White)
- **Accent**: `#00FF00` (Terminal Green)

#### Light Mode
- **Primary**: `#2563EB` (Blue)
- **Secondary**: `#7C3AED` (Purple)
- **Background**: `#FFFFFF` (White)
- **Surface**: `#F8FAFC` (Light Gray)
- **Text**: `#1E293B` (Dark Slate)
- **Accent**: `#16A34A` (Green)

### 2. Ocean Theme
**Blue and teal palette inspired by deep waters**

#### Dark Mode
- **Primary**: `#0EA5E9` (Sky Blue)
- **Secondary**: `#06B6D4` (Cyan)
- **Background**: `#0C1B1F` (Deep Ocean)
- **Surface**: `#164E63` (Ocean Blue)
- **Text**: `#F0F9FF` (Ice Blue)
- **Accent**: `#00FFFF` (Bright Cyan)

#### Light Mode
- **Primary**: `#0369A1` (Ocean Blue)
- **Secondary**: `#0891B2` (Teal)
- **Background**: `#F0F9FF` (Light Blue)
- **Surface**: `#E0F7FA` (Cyan Tint)
- **Text**: `#164E63` (Ocean Blue)
- **Accent**: `#0891B2` (Teal)

### 3. Forest Theme
**Green and brown palette evoking natural environments**

#### Dark Mode
- **Primary**: `#16A34A` (Forest Green)
- **Secondary**: `#84CC16` (Lime)
- **Background**: `#0F1B0F` (Deep Forest)
- **Surface**: `#1A2E1A` (Forest Floor)
- **Text**: `#F0FDF4` (Mint White)
- **Accent**: `#00FF41` (Bright Green)

#### Light Mode
- **Primary**: `#15803D` (Forest Green)
- **Secondary**: `#65A30D` (Olive)
- **Background**: `#F0FDF4` (Mint White)
- **Surface**: `#DCFCE7` (Light Green)
- **Text**: `#14532D` (Dark Green)
- **Accent**: `#16A34A` (Forest Green)

### 4. High Contrast Theme
**Maximum contrast for accessibility**

#### Dark Mode
- **Primary**: `#FFFFFF` (Pure White)
- **Secondary**: `#FFFF00` (Pure Yellow)
- **Background**: `#000000` (Pure Black)
- **Surface**: `#1A1A1A` (Dark Gray)
- **Text**: `#FFFFFF` (Pure White)
- **Accent**: `#00FF00` (Pure Green)

#### Light Mode
- **Primary**: `#000000` (Pure Black)
- **Secondary**: `#0000FF` (Pure Blue)
- **Background**: `#FFFFFF` (Pure White)
- **Surface**: `#F5F5F5` (Light Gray)
- **Text**: `#000000` (Pure Black)
- **Accent**: `#008000` (Pure Green)

## 🎤 Voice UI States

### 1. Idle State
- **Visual**: Subtle breathing animation
- **Color**: Text muted
- **Animation**: `voice-idle-pulse 3s ease-in-out infinite`
- **Accessibility**: "Click to start voice input"

### 2. Listening State
- **Visual**: Active glow with ripple effect
- **Color**: Accent color
- **Animation**: `voice-listening-glow 1.5s ease-in-out infinite`
- **Effects**: Box shadow, ripple animation
- **Accessibility**: "Listening for voice input"

### 3. Processing State
- **Visual**: Spinning gradient border with dots
- **Color**: Warning color
- **Animation**: `voice-processing-spin 1s linear infinite`
- **Elements**: Animated dots indicator
- **Accessibility**: "Processing voice input"

### 4. Speaking State
- **Visual**: Waveform animation
- **Color**: Primary color
- **Animation**: `voice-speaking-wave 0.8s ease-in-out infinite`
- **Elements**: 5-bar waveform visualization
- **Accessibility**: "System is responding"

### 5. Error State
- **Visual**: Shake animation with red pulse
- **Color**: Error color
- **Animation**: `voice-error-shake 0.5s ease-in-out`
- **Effects**: Shake followed by pulse
- **Accessibility**: "Voice input error occurred"

## 🧩 Component Specifications

### Terminal Component
```css
--terminal-bg: var(--color-background)
--terminal-text: var(--color-text)
--terminal-font: var(--font-family-mono)
--terminal-font-size: 14px
--terminal-accent: var(--color-accent)
```

**Features**:
- Monospace font family
- Custom scrollbar theming
- Accent color for prompts
- Scanline overlay effect (optional)

### Voice Indicator
```css
--voice-size: 50px
--voice-border-width: 2px
--voice-border-radius: 50%
--voice-transition: all 0.3s ease
```

**States**: idle, listening, processing, speaking, error
**Features**: 
- State-based animations
- Confidence meter
- Accessibility announcements
- Ripple effects

### Settings Panel
```css
--settings-bg: var(--color-surface)
--settings-border-radius: var(--border-radius-lg)
--settings-padding: var(--spacing-6)
--settings-shadow: var(--shadow-lg)
--settings-backdrop: blur(8px)
```

**Features**:
- Backdrop blur effect
- Responsive layout
- Form validation styling
- Theme preview

### Navigation Elements
```css
--nav-bg: var(--color-surface-secondary)
--nav-border-radius: var(--border-radius-md)
--nav-padding: var(--spacing-2) var(--spacing-4)
```

**Variants**: horizontal, vertical, tabs, breadcrumb
**Features**:
- Hover states
- Active indicators
- Keyboard navigation

### Form Controls
```css
--input-bg: var(--color-surface)
--input-border: var(--color-border)
--input-border-focus: var(--color-outline)
--input-border-radius: var(--border-radius-md)
```

**Elements**: input, textarea, select, button, toggle, slider
**Features**:
- Focus indicators
- Error states
- Size variants (xs, sm, md, lg, xl)

## 📱 Usage Examples

### Basic Theme Setup

```javascript
import { themeStore, themeActions } from '$lib/stores/theme.js';
import { applyTheme } from '$lib/components/themed';

// Set theme preset
themeActions.setPreset('ocean');
themeActions.setMode('dark');

// Apply theme to DOM
applyTheme('ocean', 'dark');
```

### Using Themed Components

```svelte
<script>
  import { ThemedButton, ThemedInput, VoiceIndicator } from '$lib/components/themed';
  
  let voiceState = 'idle';
</script>

<ThemedButton variant="primary" size="lg">
  Start Recording
</ThemedButton>

<ThemedInput 
  variant="terminal"
  placeholder="Enter command..."
  bind:value={command}
/>

<VoiceIndicator 
  bind:state={voiceState}
  size="lg"
  showConfidence={true}
  on:click={handleVoiceClick}
/>
```

### Custom Component Theming

```svelte
<script>
  import { currentColors } from '$lib/stores/theme.js';
  
  $: customStyles = `
    --custom-bg: ${$currentColors.surface};
    --custom-border: ${$currentColors.border};
    --custom-accent: ${$currentColors.accent};
  `;
</script>

<div class="custom-component" style={customStyles}>
  <!-- Component content -->
</div>
```

## 🎯 CSS Custom Properties System

### Color Variables
```css
/* Primary colors */
--color-primary: #3B82F6
--color-primary-rgb: 59, 130, 246
--color-secondary: #8B5CF6

/* Surface colors */
--color-background: #0F172A
--color-surface: #1E293B
--color-surface-secondary: #334155

/* Text colors */
--color-text: #F8FAFC
--color-text-secondary: #CBD5E1
--color-text-muted: #64748B

/* Status colors */
--color-success: #10B981
--color-warning: #F59E0B
--color-error: #EF4444
--color-info: #06B6D4
```

### Typography System
```css
--font-family: 'Inter', system-ui, sans-serif
--font-family-mono: 'JetBrains Mono', Monaco, monospace

--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-base: 1rem
--font-size-lg: 1.125rem
--font-size-xl: 1.25rem

--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
```

### Spacing Scale
```css
--spacing-1: 0.25rem
--spacing-2: 0.5rem
--spacing-3: 0.75rem
--spacing-4: 1rem
--spacing-6: 1.5rem
--spacing-8: 2rem
--spacing-12: 3rem
```

## ♿ Accessibility Features

### WCAG 2.1 AA Compliance
- **Contrast Ratios**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators**: Visible focus rings on all interactive elements
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: ARIA labels and live regions

### High Contrast Mode
```css
@media (prefers-contrast: high) {
  .voice-indicator {
    border-width: 3px;
  }
  
  .voice-indicator.listening {
    background: var(--color-accent);
    color: var(--color-background);
  }
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .voice-indicator,
  .ripple-effect,
  .processing-dots {
    animation: none !important;
  }
}
```

### Voice Feedback Accessibility
- **ARIA Live Regions**: Status announcements
- **ARIA Labels**: Descriptive labels for voice states
- **Screen Reader Text**: Hidden text for context
- **Confidence Announcements**: Percentage confidence levels

## 🔧 Performance Optimizations

### Theme Switching
- **Debounced Updates**: 100ms delay for rapid changes
- **CSS Transitions**: Smooth theme transitions
- **Variable Caching**: Computed style caching

### Animation Performance
- **GPU Acceleration**: Transform and opacity animations
- **Will-change Hints**: Optimized layer creation
- **Reduced Motion Respect**: Performance-conscious fallbacks

### Bundle Size
- **Tree Shaking**: Import only needed components
- **CSS Purging**: Remove unused styles
- **Component Lazy Loading**: On-demand component loading

## 🧪 Testing Strategy

### Visual Regression Testing
- **Theme Screenshots**: All preset combinations
- **Component States**: All interactive states
- **Responsive Breakpoints**: Mobile, tablet, desktop
- **Browser Compatibility**: Chrome, Firefox, Safari, Edge

### Accessibility Testing
- **Automated Tests**: axe-core integration
- **Manual Testing**: Keyboard navigation, screen readers
- **Color Contrast**: Automated contrast ratio verification
- **Voice UI Testing**: Screen reader announcements

### Performance Testing
- **Theme Switch Speed**: < 100ms target
- **Animation Performance**: 60fps target
- **Bundle Size**: Monitoring theme system impact
- **Memory Usage**: Theme store memory efficiency

## 📦 File Structure

```
voice-terminal-hybrid/
├── src/lib/
│   ├── stores/
│   │   └── theme.js              # Theme store and actions
│   ├── themes/
│   │   ├── presets.js            # Theme presets and colors
│   │   └── component-specs.js     # Component customization specs
│   ├── styles/
│   │   ├── theme-system.css      # CSS custom properties
│   │   └── voice-states.css      # Voice UI animations
│   └── components/
│       └── themed/
│           ├── ThemedButton.svelte
│           ├── ThemedInput.svelte
│           ├── ThemedModal.svelte
│           ├── VoiceIndicator.svelte
│           └── index.js          # Exports and utilities
├── THEME_DOCUMENTATION.md        # This file
└── STYLE_GUIDE.md               # Original style guide
```

## 🚀 Implementation Checklist

- [x] Theme store and management system
- [x] 4 complete theme presets (Default, Ocean, Forest, High Contrast)
- [x] Component customization specifications
- [x] Voice UI visual feedback states with animations
- [x] CSS custom property system
- [x] Flowbite-Svelte component integration
- [x] Accessibility compliance (WCAG 2.1 AA)
- [x] Performance optimizations
- [x] Responsive design support
- [x] Documentation and examples

## 🎨 Visual Mockups

### Theme Comparison Grid

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Default   │    Ocean    │   Forest    │High Contrast│
├─────────────┼─────────────┼─────────────┼─────────────┤
│ Blue/Purple │ Blue/Cyan   │Green/Brown  │ Black/White │
│ Terminal    │ Deep Water  │ Natural     │ Accessible  │
│ Classic     │ Modern      │ Organic     │ Clear       │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Voice State Progression

```
Idle → Listening → Processing → Speaking → [Error]
 🎤       🔊          ⏳         🔈        ❌
Pulse    Glow       Spin      Wave      Shake
```

### Component Layout

```
┌─────────────────────────────────────────────┐
│ [Terminal Header with Theme Selector]       │
├─────────────────────────────────────────────┤
│                                             │
│ Terminal Output Area                        │
│ > command executed                          │
│ > voice input recognized                    │
│                                             │
├─────────────────────────────────────────────┤
│ [Input Field] [Voice Indicator] [Settings]  │
└─────────────────────────────────────────────┘
```

## 📝 Next Steps

1. **Integration Testing**: Test theme system with existing components
2. **User Testing**: Gather feedback on theme preferences
3. **Performance Monitoring**: Measure theme switching performance
4. **Documentation Updates**: Keep documentation in sync with changes
5. **Additional Themes**: Consider seasonal or branded theme variants

---

*This theme system provides a solid foundation for the voice-terminal-hybrid project, ensuring consistent styling, accessibility compliance, and excellent user experience across all supported themes and components.*