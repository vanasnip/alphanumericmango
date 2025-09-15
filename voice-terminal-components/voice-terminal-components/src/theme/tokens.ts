// Design tokens for the Paper theme system

export const colors = {
  light: {
    // Backgrounds
    bgPrimary: '#EFF2F9',
    bgSecondary: '#E4EBF1',
    bgTertiary: '#B5BFC6',
    
    // Text
    textPrimary: '#6E7F8D',
    textSecondary: '#B5BFC6',
    textBright: '#6E7F8D',
    
    // Shadows
    shadowInner: '#FAFBFF',
    shadowOuter: 'rgba(22, 27, 29, 0.23)',
  },
  dark: {
    // Backgrounds
    bgPrimary: '#1A1B1E',
    bgSecondary: '#222326',
    bgTertiary: '#2A2B2F',
    
    // Text
    textPrimary: '#E4E6E9',
    textSecondary: '#B8BCC3',
    textBright: '#F0F2F5',
    
    // Shadows
    shadowRaised: 'rgba(47, 49, 53, 0.3)',
    shadowRecessed: 'rgba(15, 16, 18, 0.5)',
  },
  // Project colors
  projects: [
    '#F4B942', // Yellow/Gold
    '#5B8DEE', // Blue
    '#48C78E', // Green
    '#3ABFF8', // Cyan
    '#9333EA', // Purple
    '#92754C', // Brown
    '#EE5A52', // Red
    '#EC4899', // Pink
    '#6366F1', // Indigo
  ]
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const typography = {
  fontFamily: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  fontSize: {
    xs: '11px',
    sm: '13px',
    base: '15px',
    lg: '17px',
    xl: '20px',
    xxl: '24px',
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  lineHeight: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.75,
  },
} as const;

export const shadows = {
  raised: {
    light: `-5px -5px 10px #FAFBFF, 5px 5px 10px rgba(22, 27, 29, 0.23)`,
    dark: `-2px -2px 6px rgba(47, 49, 53, 0.3), 2px 2px 6px rgba(15, 16, 18, 0.5)`,
  },
  recessed: {
    light: `inset -5px -5px 10px #FAFBFF, inset 5px 5px 10px rgba(22, 27, 29, 0.23)`,
    dark: `inset -2px -2px 6px rgba(47, 49, 53, 0.3), inset 2px 2px 6px rgba(15, 16, 18, 0.5)`,
  },
  flat: {
    light: `-2px -2px 5px #FAFBFF, 2px 2px 5px rgba(22, 27, 29, 0.23)`,
    dark: `-1px -1px 3px rgba(47, 49, 53, 0.3), 1px 1px 3px rgba(15, 16, 18, 0.5)`,
  },
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  pill: '9999px',
} as const;

export const transitions = {
  fast: '150ms ease',
  base: '250ms ease',
  slow: '350ms ease',
} as const;