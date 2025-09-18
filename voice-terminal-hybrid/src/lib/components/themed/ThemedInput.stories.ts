import type { Meta, StoryObj } from '@storybook/svelte';
import ThemedInput from './ThemedInput.svelte';

const meta: Meta<ThemedInput> = {
  title: 'Components/ThemedInput',
  component: ThemedInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A themed input component that integrates with the voice terminal theme system. Built on top of Flowbite Svelte Input with custom theming and validation.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
      description: 'HTML input type'
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Input size variant'
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'terminal', 'accent'],
      description: 'Input style variant'
    },
    value: {
      control: { type: 'text' },
      description: 'Input value'
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text'
    },
    label: {
      control: { type: 'text' },
      description: 'Input label text'
    },
    helper: {
      control: { type: 'text' },
      description: 'Helper text below input'
    },
    error: {
      control: { type: 'text' },
      description: 'Error message (overrides helper text)'
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the input'
    },
    readonly: {
      control: { type: 'boolean' },
      description: 'Make input read-only'
    },
    required: {
      control: { type: 'boolean' },
      description: 'Mark input as required'
    },
    id: {
      control: { type: 'text' },
      description: 'HTML id attribute'
    },
    name: {
      control: { type: 'text' },
      description: 'HTML name attribute'
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

// Basic input stories
export const Default: Story = {
  args: {
    placeholder: 'Enter text here...',
    size: 'md',
    variant: 'default'
  }
};

export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'user@example.com',
    type: 'email',
    size: 'md',
    variant: 'default'
  }
};

export const WithHelper: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter your password',
    type: 'password',
    helper: 'Must be at least 8 characters long',
    size: 'md',
    variant: 'default'
  }
};

export const WithError: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    value: 'invalid@user',
    error: 'Username contains invalid characters',
    size: 'md',
    variant: 'default'
  }
};

// Size variations
export const Sizes: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: flex; flex-direction: column; gap: 1rem; width: 300px;">
        <ThemedInput size="sm" placeholder="Small input" label="Small" />
        <ThemedInput size="md" placeholder="Medium input" label="Medium" />
        <ThemedInput size="lg" placeholder="Large input" label="Large" />
      </div>
    `
  })
};

// Variant styles
export const Variants: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 400px;">
        <ThemedInput 
          variant="default" 
          placeholder="Default variant" 
          label="Default Style"
          helper="Standard input styling" 
        />
        <ThemedInput 
          variant="terminal" 
          placeholder="Terminal variant" 
          label="Terminal Style"
          helper="Monospace font with terminal aesthetics" 
        />
        <ThemedInput 
          variant="accent" 
          placeholder="Accent variant" 
          label="Accent Style"
          helper="Highlighted with accent color" 
        />
      </div>
    `
  })
};

// Input types
export const InputTypes: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        <div>
          <h4 style="color: var(--color-text); margin-bottom: 1rem;">Text Inputs</h4>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <ThemedInput type="text" placeholder="Text input" label="Text" />
            <ThemedInput type="email" placeholder="email@example.com" label="Email" />
            <ThemedInput type="password" placeholder="••••••••" label="Password" />
            <ThemedInput type="search" placeholder="Search..." label="Search" />
          </div>
        </div>
        
        <div>
          <h4 style="color: var(--color-text); margin-bottom: 1rem;">Specialized Inputs</h4>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <ThemedInput type="number" placeholder="123" label="Number" />
            <ThemedInput type="tel" placeholder="+1 (555) 123-4567" label="Phone" />
            <ThemedInput type="url" placeholder="https://example.com" label="URL" />
          </div>
        </div>
      </div>
    `
  })
};

// States
export const States: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 400px;">
        <ThemedInput 
          placeholder="Normal state" 
          label="Normal"
          helper="This is a normal input field" 
        />
        
        <ThemedInput 
          placeholder="Disabled state" 
          label="Disabled"
          disabled
          helper="This input is disabled" 
        />
        
        <ThemedInput 
          placeholder="Read-only state" 
          label="Read-only"
          value="Read-only value"
          readonly
          helper="This input is read-only" 
        />
        
        <ThemedInput 
          placeholder="Required field" 
          label="Required"
          required
          helper="This field is required" 
        />
        
        <ThemedInput 
          placeholder="Error state" 
          label="With Error"
          value="Invalid input"
          error="This field contains errors"
        />
      </div>
    `
  })
};

// Voice terminal specific examples
export const VoiceTerminalInputs: Story = {
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'Dark' }
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: flex; flex-direction: column; gap: 2rem; max-width: 600px;">
        <div style="background: var(--color-surface); padding: 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
          <h3 style="color: var(--color-text); margin-bottom: 1.5rem;">Voice Commands</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <ThemedInput 
              variant="terminal"
              placeholder="Enter voice command..."
              label="Command Input"
              helper="Type a command or use voice input"
            />
            <ThemedInput 
              variant="accent"
              placeholder="Search transcriptions..."
              type="search"
              label="Transcription Search"
              helper="Search through voice transcriptions"
            />
          </div>
        </div>
        
        <div style="background: var(--color-surface); padding: 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
          <h3 style="color: var(--color-text); margin-bottom: 1.5rem;">Settings</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <ThemedInput 
              type="text"
              placeholder="API Key"
              label="OpenAI API Key"
              helper="Enter your OpenAI API key for voice processing"
            />
            <ThemedInput 
              type="number"
              placeholder="2000"
              label="Max Tokens"
              helper="Maximum tokens for voice responses"
            />
            <ThemedInput 
              type="text"
              placeholder="gpt-4"
              label="Model"
              helper="AI model to use for voice processing"
            />
          </div>
        </div>
      </div>
    `
  })
};

// Form example
export const FormExample: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <form style="max-width: 500px; background: var(--color-surface); padding: 2rem; border-radius: var(--border-radius-lg); border: 1px solid var(--color-border);">
        <h3 style="color: var(--color-text); margin-bottom: 1.5rem;">Voice Terminal Configuration</h3>
        
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <ThemedInput 
            type="text"
            name="username"
            label="Username"
            placeholder="Enter your username"
            required
            helper="Your unique identifier"
          />
          
          <ThemedInput 
            type="email"
            name="email"
            label="Email Address"
            placeholder="user@example.com"
            required
            helper="Used for notifications and account recovery"
          />
          
          <ThemedInput 
            type="password"
            name="password"
            label="Password"
            placeholder="Enter a secure password"
            required
            helper="Must be at least 8 characters"
          />
          
          <ThemedInput 
            type="text"
            name="apiKey"
            label="API Key"
            placeholder="sk-..."
            helper="Your OpenAI API key (optional)"
          />
          
          <ThemedInput 
            variant="terminal"
            type="text"
            name="defaultCommand"
            label="Default Command"
            placeholder="/help"
            helper="Command to run on startup"
          />
        </div>
      </form>
    `
  })
};

// Validation example
export const ValidationExample: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 400px;">
        <h3 style="color: var(--color-text); margin-bottom: 1rem;">Form Validation States</h3>
        
        <ThemedInput 
          type="email"
          label="Valid Email"
          value="user@example.com"
          helper="✓ Email format is correct"
        />
        
        <ThemedInput 
          type="email"
          label="Invalid Email"
          value="invalid-email"
          error="Please enter a valid email address"
        />
        
        <ThemedInput 
          type="password"
          label="Weak Password"
          value="123"
          error="Password must be at least 8 characters long"
        />
        
        <ThemedInput 
          type="text"
          label="Required Field"
          placeholder="This field is required"
          required
          error="This field cannot be empty"
        />
        
        <ThemedInput 
          type="number"
          label="Valid Number"
          value="42"
          helper="✓ Valid number entered"
        />
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
            id: 'label',
            options: { noScroll: true }
          }
        ]
      }
    }
  },
  render: () => ({
    Component: ThemedInput,
    template: `
      <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 400px;">
        <h3 style="color: var(--color-text); margin-bottom: 1rem;">Accessibility Features</h3>
        
        <ThemedInput 
          id="accessible-input-1"
          type="text"
          label="Properly Labeled Input"
          placeholder="Enter text"
          helper="This input has proper labeling for screen readers"
          aria-describedby="helper-text-1"
        />
        
        <ThemedInput 
          id="accessible-input-2"
          type="email"
          label="Email with Validation"
          placeholder="user@example.com"
          required
          aria-required="true"
          aria-describedby="email-helper"
          helper="Email is required for account creation"
        />
        
        <ThemedInput 
          id="accessible-input-3"
          type="password"
          label="Password Field"
          placeholder="Enter password"
          required
          aria-required="true"
          aria-describedby="password-requirements"
          helper="Must contain at least 8 characters, including numbers and symbols"
        />
        
        <ThemedInput 
          id="accessible-input-4"
          type="text"
          label="Input with Error"
          value="invalid input"
          error="This input contains invalid characters"
          aria-invalid="true"
          aria-describedby="error-message-1"
        />
      </div>
    `
  })
};