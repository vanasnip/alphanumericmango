import type { Preview } from '@storybook/svelte';
import '../src/app.css';

// Import theme utilities and mocks
import { applyStorybookTheme, defaultStorybookTheme } from './mocks.js';

// Theme decorator to provide theme context to all stories
const withTheme = (Story, context) => {
  // Apply theme CSS variables when story renders
  if (typeof window !== 'undefined') {
    // Get theme settings from Storybook controls
    const themeMode = context.globals?.theme || 'dark';
    const themePreset = context.globals?.preset || 'default';
    
    // Create theme object based on controls
    const theme = {
      ...defaultStorybookTheme,
      mode: themeMode,
      preset: themePreset
    };
    
    // Apply theme to document
    applyStorybookTheme(theme);
  }
  
  return Story();
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    },
    docs: {
      story: {
        inline: true
      }
    },
    backgrounds: {
      values: [
        { name: 'Dark', value: '#1F2937' },
        { name: 'Light', value: '#F9FAFB' },
        { name: 'Terminal', value: '#000000' }
      ],
      default: 'Dark'
    },
    viewport: {
      viewports: {
        mobile1: {
          name: 'Small Mobile',
          styles: { width: '320px', height: '568px' }
        },
        mobile2: {
          name: 'Large Mobile',
          styles: { width: '414px', height: '896px' }
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' }
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1024px', height: '768px' }
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: { width: '1440px', height: '900px' }
        }
      }
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            options: { noScroll: true }
          }
        ]
      }
    }
  },
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light Mode', icon: 'sun' },
          { value: 'dark', title: 'Dark Mode', icon: 'moon' },
          { value: 'auto', title: 'Auto Mode', icon: 'circle' }
        ],
        dynamicTitle: true
      }
    },
    preset: {
      description: 'Theme preset',
      defaultValue: 'default',
      toolbar: {
        title: 'Preset',
        icon: 'component',
        items: [
          { value: 'default', title: 'Default' },
          { value: 'ocean', title: 'Ocean' },
          { value: 'forest', title: 'Forest' },
          { value: 'custom', title: 'Custom' }
        ],
        dynamicTitle: true
      }
    }
  },
  argTypes: {
    // Common component props
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl']
    },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'accent']
    },
    disabled: {
      control: { type: 'boolean' }
    }
  }
};

export default preview;