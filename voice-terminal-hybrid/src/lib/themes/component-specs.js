// Component customization specifications for voice-terminal-hybrid
// These define how each component can be themed and customized

export const componentSpecs = {
  // Terminal component styling
  terminal: {
    name: 'Terminal',
    description: 'Main terminal interface with command input/output',
    category: 'core',
    baseClass: 'terminal',
    customProperties: {
      '--terminal-bg': {
        description: 'Background color',
        type: 'color',
        default: 'var(--color-background)',
        cssProperty: 'background-color'
      },
      '--terminal-text': {
        description: 'Text color',
        type: 'color',
        default: 'var(--color-text)',
        cssProperty: 'color'
      },
      '--terminal-font': {
        description: 'Font family',
        type: 'font-family',
        default: 'var(--font-family-mono)',
        cssProperty: 'font-family'
      },
      '--terminal-font-size': {
        description: 'Font size',
        type: 'size',
        default: '14px',
        cssProperty: 'font-size'
      },
      '--terminal-line-height': {
        description: 'Line height',
        type: 'number',
        default: '1.5',
        cssProperty: 'line-height'
      },
      '--terminal-padding': {
        description: 'Internal padding',
        type: 'spacing',
        default: 'var(--spacing-4)',
        cssProperty: 'padding'
      },
      '--terminal-border': {
        description: 'Border color',
        type: 'color',
        default: 'var(--color-border)',
        cssProperty: 'border-color'
      },
      '--terminal-accent': {
        description: 'Accent color for prompts',
        type: 'color',
        default: 'var(--color-accent)',
        cssProperty: '--accent-color'
      },
      '--terminal-scroll-bg': {
        description: 'Scrollbar background',
        type: 'color',
        default: 'var(--color-surface)',
        cssProperty: '--scrollbar-bg'
      },
      '--terminal-scroll-thumb': {
        description: 'Scrollbar thumb color',
        type: 'color',
        default: 'var(--color-accent)',
        cssProperty: '--scrollbar-thumb'
      }
    },
    states: {
      default: 'Normal terminal state',
      focused: 'When terminal has focus',
      recording: 'When voice recording is active',
      processing: 'When processing voice input'
    },
    variants: {
      minimal: 'Reduced padding and borders',
      fullscreen: 'Full viewport coverage',
      windowed: 'Contained with window decorations'
    }
  },

  // Voice indicator component
  voiceIndicator: {
    name: 'Voice Indicator',
    description: 'Visual feedback for voice input states',
    category: 'voice',
    baseClass: 'voice-indicator',
    customProperties: {
      '--voice-size': {
        description: 'Indicator size',
        type: 'size',
        default: '50px',
        cssProperty: 'width, height'
      },
      '--voice-border-width': {
        description: 'Border thickness',
        type: 'size',
        default: '2px',
        cssProperty: 'border-width'
      },
      '--voice-border-radius': {
        description: 'Border radius',
        type: 'size',
        default: '50%',
        cssProperty: 'border-radius'
      },
      '--voice-transition': {
        description: 'Transition timing',
        type: 'timing',
        default: 'all 0.3s ease',
        cssProperty: 'transition'
      },
      '--voice-font-size': {
        description: 'Icon font size',
        type: 'size',
        default: '1.2rem',
        cssProperty: 'font-size'
      }
    },
    states: {
      idle: {
        description: 'Waiting for input',
        colors: {
          '--voice-color': 'var(--color-text-muted)',
          '--voice-border': 'var(--color-border)',
          '--voice-bg': 'transparent'
        },
        animation: 'subtle-pulse 3s ease-in-out infinite'
      },
      listening: {
        description: 'Actively listening',
        colors: {
          '--voice-color': 'var(--color-accent)',
          '--voice-border': 'var(--color-accent)',
          '--voice-bg': 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
        },
        animation: 'listening-glow 1.5s ease-in-out infinite',
        effects: 'box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent)'
      },
      processing: {
        description: 'Processing voice input',
        colors: {
          '--voice-color': 'var(--color-warning)',
          '--voice-border': 'var(--color-warning)',
          '--voice-bg': 'color-mix(in srgb, var(--color-warning) 10%, transparent)'
        },
        animation: 'processing-spin 1s linear infinite'
      },
      speaking: {
        description: 'System is speaking',
        colors: {
          '--voice-color': 'var(--color-primary)',
          '--voice-border': 'var(--color-primary)',
          '--voice-bg': 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
        },
        animation: 'speaking-wave 0.8s ease-in-out infinite'
      },
      error: {
        description: 'Error state',
        colors: {
          '--voice-color': 'var(--color-error)',
          '--voice-border': 'var(--color-error)',
          '--voice-bg': 'color-mix(in srgb, var(--color-error) 15%, transparent)'
        },
        animation: 'error-shake 0.5s ease-in-out'
      }
    }
  },

  // Settings panels
  settingsPanel: {
    name: 'Settings Panel',
    description: 'Configuration and settings interface',
    category: 'interface',
    baseClass: 'settings-panel',
    customProperties: {
      '--settings-bg': {
        description: 'Background color',
        type: 'color',
        default: 'var(--color-surface)',
        cssProperty: 'background-color'
      },
      '--settings-border': {
        description: 'Border color',
        type: 'color',
        default: 'var(--color-border)',
        cssProperty: 'border-color'
      },
      '--settings-border-radius': {
        description: 'Corner radius',
        type: 'size',
        default: 'var(--border-radius-lg)',
        cssProperty: 'border-radius'
      },
      '--settings-padding': {
        description: 'Internal padding',
        type: 'spacing',
        default: 'var(--spacing-6)',
        cssProperty: 'padding'
      },
      '--settings-shadow': {
        description: 'Drop shadow',
        type: 'shadow',
        default: 'var(--shadow-lg)',
        cssProperty: 'box-shadow'
      },
      '--settings-backdrop': {
        description: 'Backdrop filter',
        type: 'filter',
        default: 'blur(8px)',
        cssProperty: 'backdrop-filter'
      }
    },
    sections: {
      header: 'Panel title and controls',
      content: 'Main settings content',
      footer: 'Action buttons and status'
    }
  },

  // Navigation elements
  navigation: {
    name: 'Navigation',
    description: 'Navigation menus and controls',
    category: 'interface',
    baseClass: 'navigation',
    customProperties: {
      '--nav-bg': {
        description: 'Background color',
        type: 'color',
        default: 'var(--color-surface-secondary)',
        cssProperty: 'background-color'
      },
      '--nav-border': {
        description: 'Border color',
        type: 'color',
        default: 'var(--color-border)',
        cssProperty: 'border-color'
      },
      '--nav-text': {
        description: 'Text color',
        type: 'color',
        default: 'var(--color-text)',
        cssProperty: 'color'
      },
      '--nav-text-hover': {
        description: 'Hover text color',
        type: 'color',
        default: 'var(--color-text)',
        cssProperty: '--hover-color'
      },
      '--nav-bg-hover': {
        description: 'Hover background',
        type: 'color',
        default: 'var(--color-surface-hover)',
        cssProperty: '--hover-bg'
      },
      '--nav-border-radius': {
        description: 'Corner radius',
        type: 'size',
        default: 'var(--border-radius-md)',
        cssProperty: 'border-radius'
      },
      '--nav-padding': {
        description: 'Item padding',
        type: 'spacing',
        default: 'var(--spacing-2) var(--spacing-4)',
        cssProperty: 'padding'
      }
    },
    variants: {
      horizontal: 'Horizontal navigation bar',
      vertical: 'Vertical sidebar navigation',
      tabs: 'Tab-style navigation',
      breadcrumb: 'Breadcrumb navigation'
    }
  },

  // Project tabs
  projectTabs: {
    name: 'Project Tabs',
    description: 'Tabbed interface for project switching',
    category: 'interface',
    baseClass: 'project-tabs',
    customProperties: {
      '--tab-bg': {
        description: 'Tab background',
        type: 'color',
        default: 'var(--color-surface)',
        cssProperty: 'background-color'
      },
      '--tab-bg-active': {
        description: 'Active tab background',
        type: 'color',
        default: 'var(--color-primary)',
        cssProperty: '--active-bg'
      },
      '--tab-text': {
        description: 'Tab text color',
        type: 'color',
        default: 'var(--color-text-secondary)',
        cssProperty: 'color'
      },
      '--tab-text-active': {
        description: 'Active tab text',
        type: 'color',
        default: 'var(--color-text-inverse)',
        cssProperty: '--active-color'
      },
      '--tab-border': {
        description: 'Tab border color',
        type: 'color',
        default: 'var(--color-border)',
        cssProperty: 'border-color'
      },
      '--tab-border-radius': {
        description: 'Tab corner radius',
        type: 'size',
        default: 'var(--border-radius-md)',
        cssProperty: 'border-radius'
      },
      '--tab-padding': {
        description: 'Tab padding',
        type: 'spacing',
        default: 'var(--spacing-2) var(--spacing-4)',
        cssProperty: 'padding'
      },
      '--tab-transition': {
        description: 'Transition timing',
        type: 'timing',
        default: 'all 0.2s ease',
        cssProperty: 'transition'
      }
    },
    states: {
      default: 'Inactive tab',
      active: 'Currently selected tab',
      hover: 'Mouse hover state',
      focus: 'Keyboard focus state',
      disabled: 'Disabled tab'
    }
  },

  // Form controls
  formControls: {
    name: 'Form Controls',
    description: 'Input fields, buttons, and form elements',
    category: 'interface',
    baseClass: 'form-control',
    customProperties: {
      '--input-bg': {
        description: 'Input background',
        type: 'color',
        default: 'var(--color-surface)',
        cssProperty: 'background-color'
      },
      '--input-border': {
        description: 'Input border color',
        type: 'color',
        default: 'var(--color-border)',
        cssProperty: 'border-color'
      },
      '--input-border-focus': {
        description: 'Focused border color',
        type: 'color',
        default: 'var(--color-outline)',
        cssProperty: '--focus-border'
      },
      '--input-text': {
        description: 'Input text color',
        type: 'color',
        default: 'var(--color-text)',
        cssProperty: 'color'
      },
      '--input-placeholder': {
        description: 'Placeholder text color',
        type: 'color',
        default: 'var(--color-text-muted)',
        cssProperty: '--placeholder-color'
      },
      '--input-border-radius': {
        description: 'Input corner radius',
        type: 'size',
        default: 'var(--border-radius-md)',
        cssProperty: 'border-radius'
      },
      '--input-padding': {
        description: 'Input padding',
        type: 'spacing',
        default: 'var(--spacing-3)',
        cssProperty: 'padding'
      },
      '--input-font-size': {
        description: 'Input font size',
        type: 'size',
        default: 'var(--font-size-base)',
        cssProperty: 'font-size'
      }
    },
    elements: {
      input: 'Text input fields',
      textarea: 'Multi-line text areas',
      select: 'Select dropdowns',
      button: 'Action buttons',
      toggle: 'Toggle switches',
      slider: 'Range sliders',
      checkbox: 'Checkboxes',
      radio: 'Radio buttons'
    }
  },

  // Voice command menu
  voiceCommandMenu: {
    name: 'Voice Command Menu',
    description: 'Menu showing available voice commands',
    category: 'voice',
    baseClass: 'voice-command-menu',
    customProperties: {
      '--menu-bg': {
        description: 'Menu background',
        type: 'color',
        default: 'var(--color-surface)',
        cssProperty: 'background-color'
      },
      '--menu-border': {
        description: 'Menu border',
        type: 'color',
        default: 'var(--color-border)',
        cssProperty: 'border-color'
      },
      '--menu-shadow': {
        description: 'Menu shadow',
        type: 'shadow',
        default: 'var(--shadow-lg)',
        cssProperty: 'box-shadow'
      },
      '--command-bg-hover': {
        description: 'Command hover background',
        type: 'color',
        default: 'var(--color-surface-hover)',
        cssProperty: '--hover-bg'
      },
      '--command-text': {
        description: 'Command text color',
        type: 'color',
        default: 'var(--color-text)',
        cssProperty: 'color'
      },
      '--command-accent': {
        description: 'Command accent color',
        type: 'color',
        default: 'var(--color-accent)',
        cssProperty: '--accent-color'
      }
    }
  }
};

// Animation definitions for voice states
export const voiceAnimations = {
  'subtle-pulse': {
    name: 'Subtle Pulse',
    keyframes: {
      '0%, 100%': { opacity: '0.6' },
      '50%': { opacity: '1' }
    },
    duration: '3s',
    timingFunction: 'ease-in-out',
    iterationCount: 'infinite'
  },
  
  'listening-glow': {
    name: 'Listening Glow',
    keyframes: {
      '0%, 100%': { 
        boxShadow: '0 0 10px color-mix(in srgb, var(--color-accent) 20%, transparent)',
        transform: 'scale(1)'
      },
      '50%': { 
        boxShadow: '0 0 30px color-mix(in srgb, var(--color-accent) 40%, transparent)',
        transform: 'scale(1.05)'
      }
    },
    duration: '1.5s',
    timingFunction: 'ease-in-out',
    iterationCount: 'infinite'
  },
  
  'processing-spin': {
    name: 'Processing Spin',
    keyframes: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' }
    },
    duration: '1s',
    timingFunction: 'linear',
    iterationCount: 'infinite'
  },
  
  'speaking-wave': {
    name: 'Speaking Wave',
    keyframes: {
      '0%, 100%': { transform: 'scale(1)' },
      '25%': { transform: 'scale(1.1)' },
      '50%': { transform: 'scale(1)' },
      '75%': { transform: 'scale(1.1)' }
    },
    duration: '0.8s',
    timingFunction: 'ease-in-out',
    iterationCount: 'infinite'
  },
  
  'error-shake': {
    name: 'Error Shake',
    keyframes: {
      '0%, 100%': { transform: 'translateX(0)' },
      '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
      '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' }
    },
    duration: '0.5s',
    timingFunction: 'ease-in-out',
    iterationCount: '1'
  }
};

// Responsive breakpoints for component scaling
export const responsiveBreakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Component size variants
export const sizeVariants = {
  xs: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    height: '1.5rem'
  },
  sm: {
    fontSize: '0.875rem',
    padding: '0.5rem 0.75rem',
    height: '2rem'
  },
  md: {
    fontSize: '1rem',
    padding: '0.75rem 1rem',
    height: '2.5rem'
  },
  lg: {
    fontSize: '1.125rem',
    padding: '1rem 1.25rem',
    height: '3rem'
  },
  xl: {
    fontSize: '1.25rem',
    padding: '1.25rem 1.5rem',
    height: '3.5rem'
  }
};

// Accessibility requirements for each component
export const accessibilitySpecs = {
  voiceIndicator: {
    ariaLabel: 'Voice input status',
    ariaLive: 'polite',
    ariaAtomic: 'true',
    role: 'status',
    minimumContrastRatio: '3:1',
    keyboardNavigation: false,
    screenReaderAnnouncements: true
  },
  
  settingsPanel: {
    ariaLabel: 'Settings panel',
    role: 'dialog',
    ariaModal: 'true',
    minimumContrastRatio: '4.5:1',
    keyboardNavigation: true,
    focusTrap: true,
    escapeToClose: true
  },
  
  projectTabs: {
    ariaLabel: 'Project navigation',
    role: 'tablist',
    minimumContrastRatio: '4.5:1',
    keyboardNavigation: true,
    arrowKeyNavigation: true,
    homeEndNavigation: true
  },
  
  formControls: {
    ariaLabel: 'Required where no visible label',
    minimumContrastRatio: '4.5:1',
    keyboardNavigation: true,
    focusIndicator: true,
    errorAnnouncement: true
  }
};