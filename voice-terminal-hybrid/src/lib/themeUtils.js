/**
 * Theme utilities for merging, presets, and import/export
 */

// Theme presets
const THEME_PRESETS = {
  default: {
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
  },

  ocean: {
    mode: 'dark',
    preset: 'ocean',
    global: {
      colors: {
        primary: '#0EA5E9',
        secondary: '#06B6D4',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        background: '#0F172A',
        surface: '#1E293B',
        text: '#F1F5F9'
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
        background: '#020617',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        lineHeight: 1.5,
        padding: '1rem'
      },
      voiceIndicator: {
        inherit: true,
        overrides: {
          activeColor: '#0EA5E9',
          pulseAnimation: '2s ease-in-out infinite'
        }
      }
    }
  },

  forest: {
    mode: 'dark',
    preset: 'forest',
    global: {
      colors: {
        primary: '#22C55E',
        secondary: '#84CC16',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        background: '#052E16',
        surface: '#14532D',
        text: '#F0FDF4'
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
        background: '#001A0D',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        lineHeight: 1.5,
        padding: '1rem'
      },
      voiceIndicator: {
        inherit: true,
        overrides: {
          activeColor: '#22C55E',
          pulseAnimation: '2s ease-in-out infinite'
        }
      }
    }
  }
};

/**
 * Deep merge utility for objects
 * @param {object} target - Target object
 * @param {object} ...sources - Source objects to merge
 * @returns {object} Merged object
 */
export function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is an object
 * @param {any} item - Item to check
 * @returns {boolean} Whether item is an object
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Get available theme presets
 * @returns {object} Available theme presets
 */
export function getThemePresets() {
  return { ...THEME_PRESETS };
}

/**
 * Get specific theme preset
 * @param {string} presetName - Name of the preset
 * @returns {object|null} Theme preset or null if not found
 */
export function getThemePreset(presetName) {
  return THEME_PRESETS[presetName] ? { ...THEME_PRESETS[presetName] } : null;
}

/**
 * Apply theme preset to current theme
 * @param {string} presetName - Name of the preset to apply
 * @param {object} currentTheme - Current theme configuration
 * @returns {object} Theme with preset applied
 */
export function applyThemePreset(presetName, currentTheme = {}) {
  const preset = getThemePreset(presetName);
  if (!preset) {
    throw new Error(`Theme preset '${presetName}' not found`);
  }
  
  return deepMerge({}, preset, currentTheme);
}

/**
 * Merge multiple theme configurations
 * @param {object} baseTheme - Base theme configuration
 * @param {...object} overlays - Theme overlays to merge
 * @returns {object} Merged theme configuration
 */
export function mergeThemes(baseTheme, ...overlays) {
  return deepMerge({}, baseTheme, ...overlays);
}

/**
 * Extract theme differences
 * @param {object} baseTheme - Base theme
 * @param {object} customTheme - Custom theme
 * @returns {object} Object containing only the differences
 */
export function extractThemeDiff(baseTheme, customTheme) {
  const diff = {};
  
  function extractDiffs(base, custom, path = []) {
    for (const key in custom) {
      const currentPath = [...path, key];
      
      if (!(key in base)) {
        // New property
        setNestedProperty(diff, currentPath, custom[key]);
      } else if (isObject(custom[key]) && isObject(base[key])) {
        // Recursive comparison for objects
        extractDiffs(base[key], custom[key], currentPath);
      } else if (custom[key] !== base[key]) {
        // Different value
        setNestedProperty(diff, currentPath, custom[key]);
      }
    }
  }
  
  extractDiffs(baseTheme, customTheme);
  return diff;
}

/**
 * Set nested property in object
 * @param {object} obj - Target object
 * @param {array} path - Property path as array
 * @param {any} value - Value to set
 */
function setNestedProperty(obj, path, value) {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || !isObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

/**
 * Export theme configuration as JSON
 * @param {object} theme - Theme configuration to export
 * @param {boolean} prettify - Whether to prettify the JSON output
 * @returns {string} JSON string of the theme
 */
export function exportTheme(theme, prettify = true) {
  return JSON.stringify(theme, null, prettify ? 2 : 0);
}

/**
 * Import theme configuration from JSON
 * @param {string} jsonString - JSON string to import
 * @returns {object} Parsed theme configuration
 * @throws {Error} If JSON is invalid
 */
export function importTheme(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}

/**
 * Export theme as CSS variables
 * @param {object} theme - Theme configuration
 * @returns {Promise<string>} CSS variables string
 */
export async function exportThemeAsCSS(theme) {
  const { generateThemeCSS } = await import('./cssVariableGenerator.js');
  return generateThemeCSS(theme);
}

/**
 * Create theme backup
 * @param {object} theme - Theme to backup
 * @param {string} label - Optional label for the backup
 * @returns {object} Backup object with metadata
 */
export function createThemeBackup(theme, label = '') {
  return {
    theme: { ...theme },
    metadata: {
      label,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };
}

/**
 * Restore theme from backup
 * @param {object} backup - Backup object
 * @returns {object} Restored theme configuration
 * @throws {Error} If backup is invalid
 */
export function restoreThemeFromBackup(backup) {
  if (!backup || !backup.theme) {
    throw new Error('Invalid backup format');
  }
  
  return { ...backup.theme };
}

/**
 * Generate theme name based on colors
 * @param {object} theme - Theme configuration
 * @returns {string} Generated theme name
 */
export function generateThemeName(theme) {
  if (!theme.global?.colors) return 'Custom Theme';
  
  const { primary, background } = theme.global.colors;
  
  // Simple color name mapping
  const colorNames = {
    '#3B82F6': 'Blue',
    '#0EA5E9': 'Sky',
    '#22C55E': 'Green',
    '#EF4444': 'Red',
    '#F59E0B': 'Amber',
    '#8B5CF6': 'Purple',
    '#06B6D4': 'Cyan'
  };
  
  const primaryName = colorNames[primary] || 'Custom';
  const isDark = isColorDark(background);
  const mode = isDark ? 'Dark' : 'Light';
  
  return `${primaryName} ${mode}`;
}

/**
 * Check if a color is dark
 * @param {string} color - Hex color string
 * @returns {boolean} Whether the color is dark
 */
function isColorDark(color) {
  if (!color || typeof color !== 'string') return true;
  
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance < 0.5;
}

/**
 * Validate theme compatibility
 * @param {object} theme - Theme to validate
 * @param {string} targetVersion - Target version to validate against
 * @returns {object} Compatibility report
 */
export function validateThemeCompatibility(theme, targetVersion = '1.0.0') {
  const issues = [];
  const warnings = [];
  
  // Check for required properties
  if (!theme.global) {
    issues.push('Missing global configuration');
  }
  
  if (!theme.components) {
    issues.push('Missing components configuration');
  }
  
  // Check for deprecated properties (future use)
  // This would be expanded as the theme system evolves
  
  return {
    isCompatible: issues.length === 0,
    issues,
    warnings,
    targetVersion
  };
}

/**
 * Convert old theme format to new format
 * @param {object} oldTheme - Theme in old format
 * @returns {object} Theme in new format
 */
export function migrateTheme(oldTheme) {
  // This would be implemented as the theme system evolves
  // For now, just return the theme as-is
  return { ...oldTheme };
}

/**
 * Get theme statistics
 * @param {object} theme - Theme configuration
 * @returns {object} Theme statistics
 */
export function getThemeStats(theme) {
  const stats = {
    colorCount: 0,
    componentCount: 0,
    hasCustomTypography: false,
    hasCustomSpacing: false,
    preset: theme.preset || 'custom'
  };
  
  if (theme.global?.colors) {
    stats.colorCount = Object.keys(theme.global.colors).length;
  }
  
  if (theme.components) {
    stats.componentCount = Object.keys(theme.components).length;
  }
  
  if (theme.global?.typography?.fontFamily !== 'Inter, system-ui') {
    stats.hasCustomTypography = true;
  }
  
  if (theme.global?.spacing?.unit !== '0.25rem') {
    stats.hasCustomSpacing = true;
  }
  
  return stats;
}

export { THEME_PRESETS };