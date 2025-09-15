// Theme presets for voice-terminal-hybrid
// Each preset includes both light and dark mode variants

export const themePresets = {
  // Default Flowbite-based theme with terminal aesthetics
  default: {
    dark: {
      mode: 'dark',
      preset: 'default',
      global: {
        colors: {
          // Primary brand colors
          primary: '#3B82F6',
          primaryRgb: '59, 130, 246',
          secondary: '#8B5CF6',
          secondaryRgb: '139, 92, 246',
          
          // Status colors
          success: '#10B981',
          successRgb: '16, 185, 129',
          warning: '#F59E0B',
          warningRgb: '245, 158, 11',
          error: '#EF4444',
          errorRgb: '239, 68, 68',
          info: '#06B6D4',
          infoRgb: '6, 182, 212',
          
          // Surface colors
          background: '#0F172A',
          backgroundRgb: '15, 23, 42',
          surface: '#1E293B',
          surfaceRgb: '30, 41, 59',
          surfaceSecondary: '#334155',
          surfaceSecondaryRgb: '51, 65, 85',
          surfaceHover: '#475569',
          surfaceHoverRgb: '71, 85, 105',
          
          // Text colors
          text: '#F8FAFC',
          textRgb: '248, 250, 252',
          textSecondary: '#CBD5E1',
          textSecondaryRgb: '203, 213, 225',
          textMuted: '#64748B',
          textMutedRgb: '100, 116, 139',
          textInverse: '#1E293B',
          textInverseRgb: '30, 41, 59',
          
          // Border and outline colors
          border: '#475569',
          borderRgb: '71, 85, 105',
          borderLight: '#64748B',
          borderLightRgb: '100, 116, 139',
          outline: '#3B82F6',
          outlineRgb: '59, 130, 246',
          
          // Terminal-specific accent
          accent: '#00FF00',
          accentRgb: '0, 255, 0',
          accentDark: '#00CC00',
          accentDarkRgb: '0, 204, 0'
        }
      }
    },
    light: {
      mode: 'light',
      preset: 'default',
      global: {
        colors: {
          // Primary brand colors
          primary: '#2563EB',
          primaryRgb: '37, 99, 235',
          secondary: '#7C3AED',
          secondaryRgb: '124, 58, 237',
          
          // Status colors
          success: '#059669',
          successRgb: '5, 150, 105',
          warning: '#D97706',
          warningRgb: '217, 119, 6',
          error: '#DC2626',
          errorRgb: '220, 38, 38',
          info: '#0891B2',
          infoRgb: '8, 145, 178',
          
          // Surface colors
          background: '#FFFFFF',
          backgroundRgb: '255, 255, 255',
          surface: '#F8FAFC',
          surfaceRgb: '248, 250, 252',
          surfaceSecondary: '#F1F5F9',
          surfaceSecondaryRgb: '241, 245, 249',
          surfaceHover: '#E2E8F0',
          surfaceHoverRgb: '226, 232, 240',
          
          // Text colors
          text: '#1E293B',
          textRgb: '30, 41, 59',
          textSecondary: '#475569',
          textSecondaryRgb: '71, 85, 105',
          textMuted: '#64748B',
          textMutedRgb: '100, 116, 139',
          textInverse: '#F8FAFC',
          textInverseRgb: '248, 250, 252',
          
          // Border and outline colors
          border: '#CBD5E1',
          borderRgb: '203, 213, 225',
          borderLight: '#E2E8F0',
          borderLightRgb: '226, 232, 240',
          outline: '#2563EB',
          outlineRgb: '37, 99, 235',
          
          // Terminal-specific accent
          accent: '#16A34A',
          accentRgb: '22, 163, 74',
          accentDark: '#15803D',
          accentDarkRgb: '21, 128, 61'
        }
      }
    }
  },

  // Ocean theme - blue and teal palette
  ocean: {
    dark: {
      mode: 'dark',
      preset: 'ocean',
      global: {
        colors: {
          // Primary brand colors - ocean blues
          primary: '#0EA5E9',
          primaryRgb: '14, 165, 233',
          secondary: '#06B6D4',
          secondaryRgb: '6, 182, 212',
          
          // Status colors
          success: '#14B8A6',
          successRgb: '20, 184, 166',
          warning: '#F59E0B',
          warningRgb: '245, 158, 11',
          error: '#F97316',
          errorRgb: '249, 115, 22',
          info: '#67E8F9',
          infoRgb: '103, 232, 249',
          
          // Surface colors - deep ocean
          background: '#0C1B1F',
          backgroundRgb: '12, 27, 31',
          surface: '#164E63',
          surfaceRgb: '22, 78, 99',
          surfaceSecondary: '#0E7490',
          surfaceSecondaryRgb: '14, 116, 144',
          surfaceHover: '#155E75',
          surfaceHoverRgb: '21, 94, 117',
          
          // Text colors
          text: '#F0F9FF',
          textRgb: '240, 249, 255',
          textSecondary: '#A5F3FC',
          textSecondaryRgb: '165, 243, 252',
          textMuted: '#67E8F9',
          textMutedRgb: '103, 232, 249',
          textInverse: '#164E63',
          textInverseRgb: '22, 78, 99',
          
          // Border and outline colors
          border: '#0E7490',
          borderRgb: '14, 116, 144',
          borderLight: '#155E75',
          borderLightRgb: '21, 94, 117',
          outline: '#0EA5E9',
          outlineRgb: '14, 165, 233',
          
          // Terminal-specific accent - bright cyan
          accent: '#00FFFF',
          accentRgb: '0, 255, 255',
          accentDark: '#00E6E6',
          accentDarkRgb: '0, 230, 230'
        }
      }
    },
    light: {
      mode: 'light',
      preset: 'ocean',
      global: {
        colors: {
          // Primary brand colors
          primary: '#0369A1',
          primaryRgb: '3, 105, 161',
          secondary: '#0891B2',
          secondaryRgb: '8, 145, 178',
          
          // Status colors
          success: '#0D9488',
          successRgb: '13, 148, 136',
          warning: '#CA8A04',
          warningRgb: '202, 138, 4',
          error: '#EA580C',
          errorRgb: '234, 88, 12',
          info: '#0284C7',
          infoRgb: '2, 132, 199',
          
          // Surface colors
          background: '#F0F9FF',
          backgroundRgb: '240, 249, 255',
          surface: '#E0F7FA',
          surfaceRgb: '224, 247, 250',
          surfaceSecondary: '#B2EBF2',
          surfaceSecondaryRgb: '178, 235, 242',
          surfaceHover: '#B0E7FF',
          surfaceHoverRgb: '176, 231, 255',
          
          // Text colors
          text: '#164E63',
          textRgb: '22, 78, 99',
          textSecondary: '#0E7490',
          textSecondaryRgb: '14, 116, 144',
          textMuted: '#155E75',
          textMutedRgb: '21, 94, 117',
          textInverse: '#F0F9FF',
          textInverseRgb: '240, 249, 255',
          
          // Border and outline colors
          border: '#A5F3FC',
          borderRgb: '165, 243, 252',
          borderLight: '#CFFAFE',
          borderLightRgb: '207, 250, 254',
          outline: '#0369A1',
          outlineRgb: '3, 105, 161',
          
          // Terminal-specific accent
          accent: '#0891B2',
          accentRgb: '8, 145, 178',
          accentDark: '#0E7490',
          accentDarkRgb: '14, 116, 144'
        }
      }
    }
  },

  // Forest theme - green and brown palette
  forest: {
    dark: {
      mode: 'dark',
      preset: 'forest',
      global: {
        colors: {
          // Primary brand colors - forest greens
          primary: '#16A34A',
          primaryRgb: '22, 163, 74',
          secondary: '#84CC16',
          secondaryRgb: '132, 204, 22',
          
          // Status colors
          success: '#22C55E',
          successRgb: '34, 197, 94',
          warning: '#EAB308',
          warningRgb: '234, 179, 8',
          error: '#DC2626',
          errorRgb: '220, 38, 38',
          info: '#06B6D4',
          infoRgb: '6, 182, 212',
          
          // Surface colors - deep forest
          background: '#0F1B0F',
          backgroundRgb: '15, 27, 15',
          surface: '#1A2E1A',
          surfaceRgb: '26, 46, 26',
          surfaceSecondary: '#2D4A2D',
          surfaceSecondaryRgb: '45, 74, 45',
          surfaceHover: '#365F36',
          surfaceHoverRgb: '54, 95, 54',
          
          // Text colors
          text: '#F0FDF4',
          textRgb: '240, 253, 244',
          textSecondary: '#BBF7D0',
          textSecondaryRgb: '187, 247, 208',
          textMuted: '#86EFAC',
          textMutedRgb: '134, 239, 172',
          textInverse: '#1A2E1A',
          textInverseRgb: '26, 46, 26',
          
          // Border and outline colors
          border: '#365F36',
          borderRgb: '54, 95, 54',
          borderLight: '#4ADE80',
          borderLightRgb: '74, 222, 128',
          outline: '#16A34A',
          outlineRgb: '22, 163, 74',
          
          // Terminal-specific accent - bright green
          accent: '#00FF41',
          accentRgb: '0, 255, 65',
          accentDark: '#00E63A',
          accentDarkRgb: '0, 230, 58'
        }
      }
    },
    light: {
      mode: 'light',
      preset: 'forest',
      global: {
        colors: {
          // Primary brand colors
          primary: '#15803D',
          primaryRgb: '21, 128, 61',
          secondary: '#65A30D',
          secondaryRgb: '101, 163, 13',
          
          // Status colors
          success: '#16A34A',
          successRgb: '22, 163, 74',
          warning: '#CA8A04',
          warningRgb: '202, 138, 4',
          error: '#DC2626',
          errorRgb: '220, 38, 38',
          info: '#0891B2',
          infoRgb: '8, 145, 178',
          
          // Surface colors
          background: '#F0FDF4',
          backgroundRgb: '240, 253, 244',
          surface: '#DCFCE7',
          surfaceRgb: '220, 252, 231',
          surfaceSecondary: '#BBF7D0',
          surfaceSecondaryRgb: '187, 247, 208',
          surfaceHover: '#A7F3D0',
          surfaceHoverRgb: '167, 243, 208',
          
          // Text colors
          text: '#14532D',
          textRgb: '20, 83, 45',
          textSecondary: '#166534',
          textSecondaryRgb: '22, 101, 52',
          textMuted: '#15803D',
          textMutedRgb: '21, 128, 61',
          textInverse: '#F0FDF4',
          textInverseRgb: '240, 253, 244',
          
          // Border and outline colors
          border: '#BBF7D0',
          borderRgb: '187, 247, 208',
          borderLight: '#DCFCE7',
          borderLightRgb: '220, 252, 231',
          outline: '#15803D',
          outlineRgb: '21, 128, 61',
          
          // Terminal-specific accent
          accent: '#16A34A',
          accentRgb: '22, 163, 74',
          accentDark: '#15803D',
          accentDarkRgb: '21, 128, 61'
        }
      }
    }
  },

  // High contrast theme for accessibility
  'high-contrast': {
    dark: {
      mode: 'dark',
      preset: 'high-contrast',
      global: {
        colors: {
          // Primary brand colors - high contrast
          primary: '#FFFFFF',
          primaryRgb: '255, 255, 255',
          secondary: '#FFFF00',
          secondaryRgb: '255, 255, 0',
          
          // Status colors - highly contrasted
          success: '#00FF00',
          successRgb: '0, 255, 0',
          warning: '#FFFF00',
          warningRgb: '255, 255, 0',
          error: '#FF0000',
          errorRgb: '255, 0, 0',
          info: '#00FFFF',
          infoRgb: '0, 255, 255',
          
          // Surface colors - pure contrast
          background: '#000000',
          backgroundRgb: '0, 0, 0',
          surface: '#1A1A1A',
          surfaceRgb: '26, 26, 26',
          surfaceSecondary: '#333333',
          surfaceSecondaryRgb: '51, 51, 51',
          surfaceHover: '#4D4D4D',
          surfaceHoverRgb: '77, 77, 77',
          
          // Text colors - maximum contrast
          text: '#FFFFFF',
          textRgb: '255, 255, 255',
          textSecondary: '#E6E6E6',
          textSecondaryRgb: '230, 230, 230',
          textMuted: '#CCCCCC',
          textMutedRgb: '204, 204, 204',
          textInverse: '#000000',
          textInverseRgb: '0, 0, 0',
          
          // Border and outline colors
          border: '#FFFFFF',
          borderRgb: '255, 255, 255',
          borderLight: '#E6E6E6',
          borderLightRgb: '230, 230, 230',
          outline: '#FFFF00',
          outlineRgb: '255, 255, 0',
          
          // Terminal-specific accent
          accent: '#00FF00',
          accentRgb: '0, 255, 0',
          accentDark: '#00CC00',
          accentDarkRgb: '0, 204, 0'
        }
      }
    },
    light: {
      mode: 'light',
      preset: 'high-contrast',
      global: {
        colors: {
          // Primary brand colors
          primary: '#000000',
          primaryRgb: '0, 0, 0',
          secondary: '#0000FF',
          secondaryRgb: '0, 0, 255',
          
          // Status colors
          success: '#008000',
          successRgb: '0, 128, 0',
          warning: '#FF8C00',
          warningRgb: '255, 140, 0',
          error: '#FF0000',
          errorRgb: '255, 0, 0',
          info: '#0000FF',
          infoRgb: '0, 0, 255',
          
          // Surface colors
          background: '#FFFFFF',
          backgroundRgb: '255, 255, 255',
          surface: '#F5F5F5',
          surfaceRgb: '245, 245, 245',
          surfaceSecondary: '#E6E6E6',
          surfaceSecondaryRgb: '230, 230, 230',
          surfaceHover: '#D9D9D9',
          surfaceHoverRgb: '217, 217, 217',
          
          // Text colors
          text: '#000000',
          textRgb: '0, 0, 0',
          textSecondary: '#1A1A1A',
          textSecondaryRgb: '26, 26, 26',
          textMuted: '#333333',
          textMutedRgb: '51, 51, 51',
          textInverse: '#FFFFFF',
          textInverseRgb: '255, 255, 255',
          
          // Border and outline colors
          border: '#000000',
          borderRgb: '0, 0, 0',
          borderLight: '#333333',
          borderLightRgb: '51, 51, 51',
          outline: '#0000FF',
          outlineRgb: '0, 0, 255',
          
          // Terminal-specific accent
          accent: '#008000',
          accentRgb: '0, 128, 0',
          accentDark: '#006400',
          accentDarkRgb: '0, 100, 0'
        }
      }
    }
  }
};

// Component-specific theme configurations
export const componentThemes = {
  terminal: {
    inherit: false,
    overrides: {
      fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
      fontSize: '14px',
      lineHeight: '1.5',
      padding: '1rem',
      borderRadius: '0',
      cursor: 'text'
    }
  },
  
  voiceIndicator: {
    inherit: true,
    overrides: {
      size: '50px',
      borderWidth: '2px',
      borderRadius: '50%',
      transition: 'all 0.3s ease',
      fontSize: '1.2rem'
    }
  },
  
  projectTabs: {
    inherit: true,
    overrides: {
      borderRadius: 'var(--border-radius-md)',
      padding: '0.5rem 1rem',
      fontWeight: 'var(--font-weight-medium)',
      transition: 'all 0.2s ease'
    }
  },
  
  settingsPanel: {
    inherit: true,
    overrides: {
      borderRadius: 'var(--border-radius-lg)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-lg)',
      backdrop: 'blur(8px)'
    }
  },
  
  navigationMenu: {
    inherit: true,
    overrides: {
      borderRadius: 'var(--border-radius-md)',
      padding: '0.25rem',
      backdropFilter: 'blur(8px)',
      border: '1px solid var(--border-color)'
    }
  },
  
  formControls: {
    inherit: true,
    overrides: {
      borderRadius: 'var(--border-radius-md)',
      padding: '0.75rem',
      borderWidth: '1px',
      transition: 'all 0.2s ease',
      fontSize: 'var(--font-size-base)'
    }
  }
};

// Helper function to get theme by preset and mode
export function getTheme(preset = 'default', mode = 'dark') {
  const themeData = themePresets[preset]?.[mode];
  if (!themeData) {
    console.warn(`Theme preset '${preset}' in '${mode}' mode not found, falling back to default`);
    return themePresets.default[mode] || themePresets.default.dark;
  }
  return themeData;
}

// Helper function to get component theme
export function getComponentTheme(componentName) {
  return componentThemes[componentName] || { inherit: true, overrides: {} };
}