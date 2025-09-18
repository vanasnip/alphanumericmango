import type { Meta, StoryObj } from '@storybook/svelte';
import ThemedButton from './ThemedButton.svelte';

const meta: Meta<ThemedButton> = {
  title: 'Components/ThemedButton',
  component: ThemedButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A themed button component that integrates with the voice terminal theme system. Built on top of Flowbite Svelte Button with custom theming capabilities.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'accent'],
      description: 'Button variant determining color and style'
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Button size variant'
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the button'
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Show loading state with spinner'
    },
    pill: {
      control: { type: 'boolean' },
      description: 'Make button fully rounded (pill shape)'
    },
    outline: {
      control: { type: 'boolean' },
      description: 'Use outline style instead of filled'
    },
    type: {
      control: { type: 'select' },
      options: ['button', 'submit', 'reset'],
      description: 'HTML button type'
    },
    href: {
      control: { type: 'text' },
      description: 'If provided, renders as link instead of button'
    },
    customClass: {
      control: { type: 'text' },
      description: 'Additional CSS classes'
    },
    customStyle: {
      control: { type: 'text' },
      description: 'Additional inline styles'
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic button stories
export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md'
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Primary Button'
    }
  })
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md'
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Secondary Button'
    }
  })
};

export const Accent: Story = {
  args: {
    variant: 'accent',
    size: 'md'
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Accent Button'
    }
  })
};

// State variations
export const AllVariants: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedButton,
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
        <ThemedButton variant="primary">Primary</ThemedButton>
        <ThemedButton variant="secondary">Secondary</ThemedButton>
        <ThemedButton variant="success">Success</ThemedButton>
        <ThemedButton variant="warning">Warning</ThemedButton>
        <ThemedButton variant="error">Error</ThemedButton>
        <ThemedButton variant="info">Info</ThemedButton>
        <ThemedButton variant="accent">Accent</ThemedButton>
      </div>
    `
  })
};

export const Sizes: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedButton,
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
        <ThemedButton size="xs" variant="primary">Extra Small</ThemedButton>
        <ThemedButton size="sm" variant="primary">Small</ThemedButton>
        <ThemedButton size="md" variant="primary">Medium</ThemedButton>
        <ThemedButton size="lg" variant="primary">Large</ThemedButton>
        <ThemedButton size="xl" variant="primary">Extra Large</ThemedButton>
      </div>
    `
  })
};

export const States: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedButton,
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
        <ThemedButton variant="primary">Normal</ThemedButton>
        <ThemedButton variant="primary" disabled>Disabled</ThemedButton>
        <ThemedButton variant="primary" loading>Loading</ThemedButton>
        <ThemedButton variant="primary" outline>Outline</ThemedButton>
        <ThemedButton variant="primary" pill>Pill Shape</ThemedButton>
      </div>
    `
  })
};

// Specific use cases
export const Loading: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    loading: true
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Processing...'
    }
  })
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: true
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Disabled Button'
    }
  })
};

export const Outline: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    outline: true
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Outline Button'
    }
  })
};

export const Pill: Story = {
  args: {
    variant: 'accent',
    size: 'md',
    pill: true
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Pill Button'
    }
  })
};

export const AsLink: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    href: '#'
  },
  render: (args) => ({
    Component: ThemedButton,
    props: args,
    slots: {
      default: 'Link Button'
    }
  })
};

// Interactive examples
export const Interactive: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedButton,
    template: `
      <div style="display: flex; flex-direction: column; gap: 2rem; max-width: 600px;">
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text);">Voice Terminal Actions</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            <ThemedButton variant="accent" size="lg">🎤 Start Voice</ThemedButton>
            <ThemedButton variant="secondary">⏹️ Stop</ThemedButton>
            <ThemedButton variant="info">📝 Transcribe</ThemedButton>
            <ThemedButton variant="warning" outline>⚙️ Settings</ThemedButton>
          </div>
        </div>
        
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text);">Form Actions</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            <ThemedButton variant="success" type="submit">✓ Submit</ThemedButton>
            <ThemedButton variant="error" type="button">✗ Cancel</ThemedButton>
            <ThemedButton variant="secondary" type="reset">🔄 Reset</ThemedButton>
          </div>
        </div>
        
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text);">Loading States</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            <ThemedButton variant="primary" loading>Processing...</ThemedButton>
            <ThemedButton variant="accent" loading>Connecting...</ThemedButton>
            <ThemedButton variant="success" loading>Saving...</ThemedButton>
          </div>
        </div>
      </div>
    `
  })
};

// Theme variations showcase
export const ThemeShowcase: Story = {
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'Dark' }
  },
  render: () => ({
    Component: ThemedButton,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; padding: 2rem;">
        <div style="background: var(--color-surface); padding: 1.5rem; border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
          <h4 style="color: var(--color-text); margin-bottom: 1rem;">Standard Actions</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <ThemedButton variant="primary" size="sm">Primary Action</ThemedButton>
            <ThemedButton variant="secondary" size="sm">Secondary Action</ThemedButton>
            <ThemedButton variant="success" size="sm">Success Action</ThemedButton>
          </div>
        </div>
        
        <div style="background: var(--color-surface); padding: 1.5rem; border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
          <h4 style="color: var(--color-text); margin-bottom: 1rem;">Alert Actions</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <ThemedButton variant="warning" size="sm">Warning</ThemedButton>
            <ThemedButton variant="error" size="sm">Error</ThemedButton>
            <ThemedButton variant="info" size="sm">Information</ThemedButton>
          </div>
        </div>
        
        <div style="background: var(--color-surface); padding: 1.5rem; border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
          <h4 style="color: var(--color-text); margin-bottom: 1rem;">Special Actions</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <ThemedButton variant="accent" size="sm">Voice Command</ThemedButton>
            <ThemedButton variant="accent" size="sm" pill>Voice Record</ThemedButton>
            <ThemedButton variant="primary" size="sm" outline>Settings</ThemedButton>
          </div>
        </div>
      </div>
    `
  })
};

// Accessibility story
export const Accessibility: Story = {
  parameters: {
    layout: 'padded',
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            options: { noScroll: true }
          },
          {
            id: 'button-name',
            options: { noScroll: true }
          }
        ]
      }
    }
  },
  render: () => ({
    Component: ThemedButton,
    template: `
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px;">
        <h3 style="color: var(--color-text); margin-bottom: 1rem;">Accessibility Features</h3>
        
        <ThemedButton 
          variant="primary" 
          type="button"
          aria-label="Start voice recording session"
        >
          🎤 Start Recording
        </ThemedButton>
        
        <ThemedButton 
          variant="error" 
          type="button"
          aria-label="Stop current voice recording"
        >
          ⏹️ Stop Recording
        </ThemedButton>
        
        <ThemedButton 
          variant="info" 
          type="button"
          disabled
          aria-label="Transcription feature currently unavailable"
        >
          📝 Transcribe (Unavailable)
        </ThemedButton>
        
        <ThemedButton 
          variant="accent" 
          type="button"
          loading
          aria-label="Processing voice command, please wait"
        >
          Processing...
        </ThemedButton>
      </div>
    `
  })
};