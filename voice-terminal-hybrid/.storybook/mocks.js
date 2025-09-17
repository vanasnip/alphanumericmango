// Mock implementations for Storybook environment
// These mocks help Storybook render components that depend on SvelteKit specific features

// Mock $app/environment
export const browser = true;

// Mock $app/stores
export const page = {
  subscribe: (fn) => {
    fn({
      url: new URL('http://localhost:6006'),
      params: {},
      route: { id: null },
      data: {}
    });
    return () => {};
  }
};

export const navigating = {
  subscribe: (fn) => {
    fn(null);
    return () => {};
  }
};

export const updated = {
  subscribe: (fn) => {
    fn(false);
    return () => {};
  }
};

// Mock theme utilities that might not exist yet
export const mockThemeUtils = {
  updateThemeCSS: (theme) => {
    // Mock implementation for Storybook
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme?.global?.colors) {
        Object.entries(theme.global.colors).forEach(([key, value]) => {
          const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
          root.style.setProperty(cssVar, value);
        });
      }
    }
  }
};

// Mock CSS variable generator
export const cssVariableGenerator = {
  updateThemeCSS: mockThemeUtils.updateThemeCSS
};

// Default theme for Storybook
export const defaultStorybookTheme = {
  mode: 'dark',
  preset: 'default',
  global: {
    colors: {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#06B6D4',
      accent: '#84CC16',
      background: '#1F2937',
      surface: '#374151',
      surfaceSecondary: '#4B5563',
      surfaceHover: '#6B7280',
      text: '#F9FAFB',
      textMuted: '#D1D5DB',
      textInverse: '#111827',
      border: '#6B7280',
      outline: '#3B82F6'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyMono: 'JetBrains Mono, Consolas, monospace',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem'
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75'
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
        xl: '0.75rem',
        full: '9999px'
      },
      width: '1px',
      style: 'solid'
    }
  }
};

// Helper to apply theme to document
export function applyStorybookTheme(theme = defaultStorybookTheme) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Set theme data attributes
  root.setAttribute('data-theme', theme.mode);
  root.setAttribute('data-theme-preset', theme.preset);
  
  // Apply color variables
  if (theme.global?.colors) {
    Object.entries(theme.global.colors).forEach(([key, value]) => {
      const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });
  }
  
  // Apply typography variables
  if (theme.global?.typography) {
    const { typography } = theme.global;
    if (typography.fontFamily) {
      root.style.setProperty('--font-family', typography.fontFamily);
    }
    if (typography.fontFamilyMono) {
      root.style.setProperty('--font-family-mono', typography.fontFamilyMono);
    }
    if (typography.fontSize) {
      Object.entries(typography.fontSize).forEach(([key, value]) => {
        root.style.setProperty(`--font-size-${key}`, value);
      });
    }
    if (typography.fontWeight) {
      Object.entries(typography.fontWeight).forEach(([key, value]) => {
        root.style.setProperty(`--font-weight-${key}`, value);
      });
    }
    if (typography.lineHeight) {
      Object.entries(typography.lineHeight).forEach(([key, value]) => {
        root.style.setProperty(`--line-height-${key}`, value);
      });
    }
  }
  
  // Apply spacing variables
  if (theme.global?.spacing) {
    root.style.setProperty('--spacing-unit', theme.global.spacing.unit);
    theme.global.spacing.scale.forEach((value, index) => {
      root.style.setProperty(`--spacing-${index}`, `${value * 0.25}rem`);
    });
  }
  
  // Apply border variables
  if (theme.global?.borders) {
    const { borders } = theme.global;
    if (borders.radius) {
      Object.entries(borders.radius).forEach(([key, value]) => {
        root.style.setProperty(`--border-radius-${key}`, value);
      });
    }
    if (borders.width) {
      root.style.setProperty('--border-width', borders.width);
    }
  }
  
  // Apply additional CSS variables for components
  root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgb(0 0 0 / 0.05)');
  root.style.setProperty('--shadow-md', '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)');
  root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)');
  root.style.setProperty('--shadow-xl', '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)');
  root.style.setProperty('--shadow-2xl', '0 25px 50px -12px rgb(0 0 0 / 0.25)');
  
  root.style.setProperty('--transition-fast', 'all 150ms ease-in-out');
  root.style.setProperty('--transition-normal', 'all 250ms ease-in-out');
  root.style.setProperty('--transition-slow', 'all 350ms ease-in-out');
}