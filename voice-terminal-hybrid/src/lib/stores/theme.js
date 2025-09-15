import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { fileWatcher } from '../fileWatcher.js';
import { updateThemeCSS } from '../cssVariableGenerator.js';
import { validateTheme, validatePartialTheme, formatValidationErrors } from '../themeValidator.js';
import { 
  deepMerge, 
  getThemePresets, 
  getThemePreset, 
  applyThemePreset,
  exportTheme,
  importTheme,
  createThemeBackup,
  restoreThemeFromBackup
} from '../themeUtils.js';

// Theme types and interfaces
export const THEME_MODES = ['light', 'dark', 'auto'];
export const THEME_PRESETS = ['default', 'ocean', 'forest', 'custom'];

// Default theme configuration
const DEFAULT_THEME = {
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
    },
    typography: {
      fontFamily: 'Inter, system-ui',
      fontSize: {
        base: '16px',
        scale: 1.25
      }
    },
    spacing: {
      unit: '0.25rem',
      scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
    },
    borders: {
      radius: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px'
      },
      width: '1px',
      style: 'solid'
    }
  },
  components: {
    terminal: {
      inherit: false,
      background: '#000000',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      lineHeight: 1.5,
      padding: '1rem'
    },
    voiceIndicator: {
      inherit: true,
      overrides: {
        activeColor: '#10B981',
        pulseAnimation: '2s ease-in-out infinite'
      }
    }
  }
};

// Create the main theme store
function createThemeStore() {
  const { subscribe, set, update } = writable(DEFAULT_THEME);
  let fileWatcherCleanup = null;

  return {
    subscribe,
    set,
    update,
    
    // Load theme from settings.json
    loadSettings: async () => {
      if (!browser) return;
      
      try {
        const response = await fetch('/settings.json');
        if (!response.ok) {
          throw new Error(`Failed to load settings: ${response.status}`);
        }
        
        const settings = await response.json();
        if (settings.theme) {
          // Validate theme before applying
          const validation = validateTheme(settings.theme);
          if (!validation.isValid) {
            const errorMessage = `Theme validation failed:\n${formatValidationErrors(validation.errors)}`;
            themeError.set(errorMessage);
            console.warn('Theme validation errors:', validation.errors);
            return;
          }
          
          update(current => {
            const newTheme = mergeTheme(current, settings.theme);
            updateThemeCSS(newTheme);
            return newTheme;
          });
          themeError.set(null);
        }
      } catch (error) {
        console.warn('Failed to load theme settings:', error);
        themeError.set(`Failed to load theme settings: ${error.message}`);
        // Fall back to localStorage
        const storedTheme = loadFromLocalStorage();
        if (storedTheme !== DEFAULT_THEME) {
          set(storedTheme);
        }
      }
    },

    // Start watching settings.json for changes
    startWatching: () => {
      if (!browser || fileWatcherCleanup) return;
      
      fileWatcherCleanup = fileWatcher.watch('/settings.json', () => {
        themeStore.loadSettings();
      }, 100); // 100ms debounce
    },

    // Stop watching settings.json
    stopWatching: () => {
      if (fileWatcherCleanup) {
        fileWatcherCleanup();
        fileWatcherCleanup = null;
      }
    },

    // Save theme to localStorage (fallback)
    saveToLocalStorage: (theme) => {
      if (!browser) return;
      try {
        localStorage.setItem('voice-terminal-theme', JSON.stringify(theme));
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error);
      }
    },

    // Update theme mode
    setMode: (mode) => {
      if (!THEME_MODES.includes(mode)) {
        console.warn(`Invalid theme mode: ${mode}`);
        return;
      }
      
      update(theme => {
        const newTheme = { ...theme, mode };
        updateThemeCSS(newTheme);
        themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
    },

    // Update theme preset
    setPreset: (preset) => {
      if (!THEME_PRESETS.includes(preset)) {
        console.warn(`Invalid theme preset: ${preset}`);
        return;
      }
      
      update(theme => {
        const newTheme = { ...theme, preset };
        updateThemeCSS(newTheme);
        themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
    },

    // Update specific color
    setColor: (colorKey, value) => {
      update(theme => {
        const newTheme = {
          ...theme,
          global: {
            ...theme.global,
            colors: {
              ...theme.global.colors,
              [colorKey]: value
            }
          }
        };
        updateThemeCSS(newTheme);
        themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
    },

    // Update component theme
    setComponentTheme: (component, config) => {
      update(theme => {
        const newTheme = {
          ...theme,
          components: {
            ...theme.components,
            [component]: {
              ...theme.components[component],
              ...config
            }
          }
        };
        updateThemeCSS(newTheme);
        themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
    },

    // Reset to default theme
    reset: () => {
      set(DEFAULT_THEME);
      updateThemeCSS(DEFAULT_THEME);
      if (browser) {
        localStorage.removeItem('voice-terminal-theme');
      }
    },

    // Apply theme preset
    applyPreset: (presetName) => {
      try {
        const preset = getThemePreset(presetName);
        if (!preset) {
          throw new Error(`Theme preset '${presetName}' not found`);
        }
        
        const validation = validateTheme(preset);
        if (!validation.isValid) {
          const errorMessage = `Preset validation failed:\n${formatValidationErrors(validation.errors)}`;
          themeError.set(errorMessage);
          return;
        }
        
        set(preset);
        updateThemeCSS(preset);
        themeStore.saveToLocalStorage(preset);
        themeError.set(null);
      } catch (error) {
        themeError.set(`Failed to apply preset: ${error.message}`);
      }
    },

    // Get available presets
    getPresets: () => getThemePresets(),

    // Export current theme
    export: (prettify = true) => {
      let currentTheme;
      themeStore.subscribe(theme => currentTheme = theme)();
      return exportTheme(currentTheme, prettify);
    },

    // Import theme from JSON
    import: (jsonString) => {
      try {
        const importedTheme = importTheme(jsonString);
        const validation = validateTheme(importedTheme);
        
        if (!validation.isValid) {
          const errorMessage = `Imported theme validation failed:\n${formatValidationErrors(validation.errors)}`;
          themeError.set(errorMessage);
          return false;
        }
        
        set(importedTheme);
        updateThemeCSS(importedTheme);
        themeStore.saveToLocalStorage(importedTheme);
        themeError.set(null);
        return true;
      } catch (error) {
        themeError.set(`Failed to import theme: ${error.message}`);
        return false;
      }
    },

    // Create backup of current theme
    createBackup: (label = '') => {
      let currentTheme;
      themeStore.subscribe(theme => currentTheme = theme)();
      return createThemeBackup(currentTheme, label);
    },

    // Restore theme from backup
    restoreBackup: (backup) => {
      try {
        const restoredTheme = restoreThemeFromBackup(backup);
        const validation = validateTheme(restoredTheme);
        
        if (!validation.isValid) {
          const errorMessage = `Backup validation failed:\n${formatValidationErrors(validation.errors)}`;
          themeError.set(errorMessage);
          return false;
        }
        
        set(restoredTheme);
        updateThemeCSS(restoredTheme);
        themeStore.saveToLocalStorage(restoredTheme);
        themeError.set(null);
        return true;
      } catch (error) {
        themeError.set(`Failed to restore backup: ${error.message}`);
        return false;
      }
    }
  };
}

// Load theme from localStorage
function loadFromLocalStorage() {
  if (!browser) return DEFAULT_THEME;
  
  try {
    const stored = localStorage.getItem('voice-terminal-theme');
    if (stored) {
      const parsedTheme = JSON.parse(stored);
      return mergeTheme(DEFAULT_THEME, parsedTheme);
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error);
  }
  
  return DEFAULT_THEME;
}

// Merge theme configurations using deep merge utility
function mergeTheme(defaultTheme, userTheme) {
  return deepMerge({}, defaultTheme, userTheme);
}

// Create store instances
export const themeStore = createThemeStore();
export const themeError = writable(null);

// Computed stores for easy access to specific theme parts
export const colors = derived(themeStore, $theme => $theme.global.colors);
export const typography = derived(themeStore, $theme => $theme.global.typography);
export const spacing = derived(themeStore, $theme => $theme.global.spacing);
export const borders = derived(themeStore, $theme => $theme.global.borders);

// Component-specific theme stores
export const terminalTheme = derived(themeStore, $theme => {
  const terminal = $theme.components.terminal;
  return terminal.inherit ? { ...$theme.global, ...terminal.overrides } : terminal;
});

export const voiceIndicatorTheme = derived(themeStore, $theme => {
  const indicator = $theme.components.voiceIndicator;
  return indicator.inherit ? { ...$theme.global, ...indicator.overrides } : indicator;
});

// Voice states configuration
export const voiceStates = derived(themeStore, $theme => ({
  idle: {
    color: $theme.global.colors.text,
    backgroundColor: 'transparent',
    borderColor: $theme.global.colors.primary,
    animation: 'none',
    boxShadow: 'none'
  },
  listening: {
    color: $theme.global.colors.success,
    backgroundColor: `color-mix(in srgb, ${$theme.global.colors.success} 10%, transparent)`,
    borderColor: $theme.global.colors.success,
    animation: 'pulse 2s ease-in-out infinite',
    boxShadow: `0 0 0 4px color-mix(in srgb, ${$theme.global.colors.success} 20%, transparent)`
  },
  processing: {
    color: $theme.global.colors.warning,
    backgroundColor: `color-mix(in srgb, ${$theme.global.colors.warning} 10%, transparent)`,
    borderColor: $theme.global.colors.warning,
    animation: 'spin 2s linear infinite',
    boxShadow: `0 0 0 2px color-mix(in srgb, ${$theme.global.colors.warning} 30%, transparent)`
  },
  speaking: {
    color: $theme.global.colors.primary,
    backgroundColor: `color-mix(in srgb, ${$theme.global.colors.primary} 10%, transparent)`,
    borderColor: $theme.global.colors.primary,
    animation: 'bounce 1s ease-in-out infinite',
    boxShadow: `0 0 0 3px color-mix(in srgb, ${$theme.global.colors.primary} 25%, transparent)`
  },
  error: {
    color: $theme.global.colors.error,
    backgroundColor: `color-mix(in srgb, ${$theme.global.colors.error} 10%, transparent)`,
    borderColor: $theme.global.colors.error,
    animation: 'shake 0.5s ease-in-out 3',
    boxShadow: `0 0 0 2px color-mix(in srgb, ${$theme.global.colors.error} 30%, transparent)`
  }
}));

// Current colors derived store for easy access
export const currentColors = derived(themeStore, $theme => $theme.global.colors);

// Note: Auto-loading is now handled by components that use the theme store
// This prevents SSR issues with async initialization