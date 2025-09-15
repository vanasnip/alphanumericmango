import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
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
  const { subscribe, set: _set, update: _update } = writable(DEFAULT_THEME);
  let storageWatcherCleanup = null;

  // Internal save function
  const saveToLocalStorageInternal = (theme) => {
    if (!browser) return false;
    
    try {
      const themeJson = JSON.stringify(theme);
      localStorage.setItem('voice-terminal-theme', themeJson);
      return true;
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
      themeError.set(`Failed to save theme: ${error.message}`);
      return false;
    }
  };

  // Override set to ensure persistence
  const set = (theme) => {
    _set(theme);
    updateThemeCSS(theme);
    saveToLocalStorageInternal(theme);
  };

  // Override update to ensure persistence  
  const update = (updater) => {
    let newTheme;
    _update(current => {
      newTheme = updater(current);
      return newTheme;
    });
    if (newTheme) {
      updateThemeCSS(newTheme);
      saveToLocalStorageInternal(newTheme);
    }
    return newTheme;
  };

  return {
    subscribe,
    set,
    update,
    
    // Load theme from localStorage
    loadSettings: async () => {
      if (!browser) return;
      
      try {
        // Load from localStorage instead of making API calls
        const storedTheme = loadFromLocalStorage();
        if (storedTheme && JSON.stringify(storedTheme) !== JSON.stringify(DEFAULT_THEME)) {
          // Validate theme before applying
          const validation = validateTheme(storedTheme);
          if (!validation.isValid) {
            const errorMessage = `Theme validation failed:\n${formatValidationErrors(validation.errors)}`;
            themeError.set(errorMessage);
            console.warn('Theme validation errors:', validation.errors);
            // Reset to default on validation failure
            localStorage.removeItem('voice-terminal-theme');
            set(DEFAULT_THEME);
            updateThemeCSS(DEFAULT_THEME);
            return;
          }
          
          set(storedTheme);
          updateThemeCSS(storedTheme);
          themeError.set(null);
        } else {
          // Use default theme and apply CSS
          set(DEFAULT_THEME);
          updateThemeCSS(DEFAULT_THEME);
        }
      } catch (error) {
        console.warn('Failed to load theme settings from localStorage:', error);
        themeError.set(`Failed to load theme settings: ${error.message}`);
        // Fall back to default theme
        set(DEFAULT_THEME);
        updateThemeCSS(DEFAULT_THEME);
      }
    },

    // Start watching localStorage for changes (from other tabs)
    startWatching: () => {
      if (!browser || storageWatcherCleanup) return;
      
      // Listen for storage events from other tabs
      const handleStorageChange = (e) => {
        if (e.key === 'voice-terminal-theme' && e.newValue) {
          try {
            const newTheme = JSON.parse(e.newValue);
            const validation = validateTheme(newTheme);
            if (validation.isValid) {
              set(newTheme);
              updateThemeCSS(newTheme);
              themeError.set(null);
            }
          } catch (error) {
            console.warn('Failed to sync theme from storage event:', error);
          }
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      storageWatcherCleanup = () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    },

    // Stop watching localStorage
    stopWatching: () => {
      if (storageWatcherCleanup) {
        storageWatcherCleanup();
        storageWatcherCleanup = null;
      }
    },

    // Save theme to localStorage
    saveToLocalStorage: (theme) => {
      return saveToLocalStorageInternal(theme);
    },

    // Update theme mode
    setMode: (mode) => {
      if (!THEME_MODES.includes(mode)) {
        console.warn(`Invalid theme mode: ${mode}`);
        return false;
      }
      
      let success = false;
      update(theme => {
        const newTheme = { ...theme, mode };
        updateThemeCSS(newTheme);
        success = themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
      
      return success;
    },

    // Update theme preset
    setPreset: (preset) => {
      if (!THEME_PRESETS.includes(preset)) {
        console.warn(`Invalid theme preset: ${preset}`);
        return false;
      }
      
      let success = false;
      update(theme => {
        const newTheme = { ...theme, preset };
        updateThemeCSS(newTheme);
        success = themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
      
      return success;
    },

    // Update specific color
    setColor: (colorKey, value) => {
      let success = false;
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
        success = themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
      
      return success;
    },

    // Update component theme
    setComponentTheme: (component, config) => {
      let success = false;
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
        success = themeStore.saveToLocalStorage(newTheme);
        return newTheme;
      });
      
      return success;
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
      // Return the merged theme to ensure all default properties are present
      return mergeTheme(DEFAULT_THEME, parsedTheme);
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error);
    // Clear corrupted data
    try {
      localStorage.removeItem('voice-terminal-theme');
    } catch (e) {
      // Ignore cleanup errors
    }
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

// Auto-load theme on store creation (but only once)
if (browser) {
  // Initialize theme immediately
  themeStore.loadSettings();
  themeStore.startWatching();
}