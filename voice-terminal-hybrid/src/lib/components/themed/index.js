// Themed component exports
// Centralized export file for all themed Flowbite-Svelte components

export { default as ThemedButton } from './ThemedButton.svelte';
export { default as ThemedInput } from './ThemedInput.svelte';
export { default as ThemedModal } from './ThemedModal.svelte';
export { default as ThemedCard } from './ThemedCard.svelte';
export { default as VoiceIndicator } from './VoiceIndicator.svelte';

// Re-export theme utilities and stores
export { 
  themeStore, 
  currentMode, 
  currentPreset, 
  currentColors, 
  currentTypography,
  themeActions,
  voiceStates,
  createDebouncedThemeUpdate
} from '$lib/stores/theme.js';

export { 
  themePresets, 
  componentThemes, 
  getTheme, 
  getComponentTheme 
} from '$lib/themes/presets.js';

export { 
  componentSpecs, 
  voiceAnimations, 
  responsiveBreakpoints, 
  sizeVariants, 
  accessibilitySpecs 
} from '$lib/themes/component-specs.js';

// Theme application utilities
export function applyTheme(preset = 'default', mode = 'dark') {
  const theme = getTheme(preset, mode);
  const root = document.documentElement;
  
  // Apply theme data attributes
  root.setAttribute('data-theme', mode);
  root.setAttribute('data-theme-preset', preset);
  
  // Apply CSS custom properties
  if (theme.global?.colors) {
    Object.entries(theme.global.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    });
  }
  
  return theme;
}

export function removeTheme() {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-theme-preset');
  
  // Remove all theme-related custom properties
  const styles = root.style;
  for (let i = styles.length - 1; i >= 0; i--) {
    const property = styles[i];
    if (property.startsWith('--color-') || property.startsWith('--theme-')) {
      styles.removeProperty(property);
    }
  }
}

export function getThemeVariables() {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  const themeVars = {};
  
  for (let i = 0; i < computedStyle.length; i++) {
    const property = computedStyle[i];
    if (property.startsWith('--color-') || property.startsWith('--theme-')) {
      themeVars[property] = computedStyle.getPropertyValue(property).trim();
    }
  }
  
  return themeVars;
}

// Component integration helpers
export function createThemedComponent(BaseComponent, defaultTheme = {}) {
  return function ThemedWrapper(props) {
    const { customClass = '', customStyle = '', ...otherProps } = props;
    
    return BaseComponent({
      ...otherProps,
      class: `themed-component theme-transition ${customClass}`.trim(),
      style: `${Object.entries(defaultTheme).map(([key, value]) => `--${key}: ${value}`).join('; ')}; ${customStyle}`
    });
  };
}

// Performance optimization for theme switching
let themeUpdateTimeout;
export function debouncedThemeUpdate(updateFn, delay = 100) {
  clearTimeout(themeUpdateTimeout);
  themeUpdateTimeout = setTimeout(updateFn, delay);
}

// Accessibility helpers
export function announceThemeChange(preset, mode) {
  const announcement = `Theme changed to ${preset} ${mode} mode`;
  
  // Create or update aria-live region
  let announcer = document.getElementById('theme-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'theme-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }
  
  announcer.textContent = announcement;
}

// Theme validation
export function validateThemePreset(preset) {
  return Object.keys(themePresets).includes(preset);
}

export function validateThemeMode(mode) {
  return ['light', 'dark', 'auto'].includes(mode);
}

// CSS variable helpers
export function setCSSVariable(property, value, element = document.documentElement) {
  element.style.setProperty(property, value);
}

export function getCSSVariable(property, element = document.documentElement) {
  return getComputedStyle(element).getPropertyValue(property).trim();
}

export function removeCSSVariable(property, element = document.documentElement) {
  element.style.removeProperty(property);
}

// Media query helpers for theme preferences
export function getSystemThemePreference() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function watchSystemThemeChanges(callback) {
  if (typeof window === 'undefined') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => callback(e.matches ? 'dark' : 'light');
  
  mediaQuery.addEventListener('change', handler);
  
  return () => mediaQuery.removeEventListener('change', handler);
}

export function getReducedMotionPreference() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getContrastPreference() {
  if (typeof window === 'undefined') return 'normal';
  if (window.matchMedia('(prefers-contrast: high)').matches) return 'high';
  if (window.matchMedia('(prefers-contrast: low)').matches) return 'low';
  return 'normal';
}