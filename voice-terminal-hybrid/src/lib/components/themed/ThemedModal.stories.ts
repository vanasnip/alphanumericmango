import type { Meta, StoryObj } from '@storybook/svelte';
import ThemedModal from './ThemedModal.svelte';
import ThemedButton from './ThemedButton.svelte';

const meta: Meta<ThemedModal> = {
  title: 'Components/ThemedModal',
  component: ThemedModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A themed modal dialog component that integrates with the voice terminal theme system. Built on top of Flowbite Svelte Modal with custom theming and variants.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: { type: 'boolean' },
      description: 'Controls modal visibility'
    },
    title: {
      control: { type: 'text' },
      description: 'Modal title text'
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'],
      description: 'Modal size variant'
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'settings', 'terminal', 'voice'],
      description: 'Modal style variant'
    },
    placement: {
      control: { type: 'select' },
      options: ['center', 'top-left', 'top-center', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'],
      description: 'Modal position on screen'
    },
    backdrop: {
      control: { type: 'boolean' },
      description: 'Show backdrop overlay'
    },
    outsideclose: {
      control: { type: 'boolean' },
      description: 'Close modal when clicking outside'
    },
    dismissable: {
      control: { type: 'boolean' },
      description: 'Show close button'
    },
    autoclose: {
      control: { type: 'boolean' },
      description: 'Auto-close after action'
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

// Basic modal stories
export const Default: Story = {
  args: {
    open: true,
    title: 'Default Modal',
    size: 'md',
    variant: 'default'
  },
  render: (args) => ({
    Component: ThemedModal,
    props: args,
    slots: {
      default: `
        <p>This is a basic modal dialog with default styling. It can contain any content and provides a clean, accessible interface for user interactions.</p>
        <p>The modal integrates with the voice terminal theme system and responds to theme changes automatically.</p>
      `
    }
  })
};

export const WithCustomFooter: Story = {
  args: {
    open: true,
    title: 'Custom Footer Modal',
    size: 'md',
    variant: 'default'
  },
  render: (args) => ({
    Component: ThemedModal,
    props: args,
    slots: {
      default: `
        <p>This modal demonstrates custom footer content with themed buttons.</p>
      `,
      footer: `
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <ThemedButton variant="secondary" size="sm">Cancel</ThemedButton>
          <ThemedButton variant="primary" size="sm">Save Changes</ThemedButton>
          <ThemedButton variant="accent" size="sm">Apply & Continue</ThemedButton>
        </div>
      `
    }
  })
};

// Size variations
export const Sizes: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => ({
    Component: ThemedModal,
    template: `
      <div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding: 2rem;">
          <ThemedButton 
            variant="primary" 
            on:click={() => smallOpen = true}
          >
            Small Modal
          </ThemedButton>
          <ThemedButton 
            variant="primary" 
            on:click={() => mediumOpen = true}
          >
            Medium Modal
          </ThemedButton>
          <ThemedButton 
            variant="primary" 
            on:click={() => largeOpen = true}
          >
            Large Modal
          </ThemedButton>
          <ThemedButton 
            variant="primary" 
            on:click={() => extraLargeOpen = true}
          >
            Extra Large Modal
          </ThemedButton>
        </div>
        
        <ThemedModal 
          bind:open={smallOpen}
          title="Small Modal"
          size="sm"
        >
          <p>This is a small modal. Perfect for simple confirmations or alerts.</p>
        </ThemedModal>
        
        <ThemedModal 
          bind:open={mediumOpen}
          title="Medium Modal"
          size="md"
        >
          <p>This is a medium modal. Good for forms and detailed content.</p>
          <p>It provides a good balance between content space and screen real estate.</p>
        </ThemedModal>
        
        <ThemedModal 
          bind:open={largeOpen}
          title="Large Modal"
          size="lg"
        >
          <p>This is a large modal. Suitable for complex forms or detailed content.</p>
          <p>It provides more space for content while maintaining readability.</p>
          <p>Perfect for settings panels or data entry forms.</p>
        </ThemedModal>
        
        <ThemedModal 
          bind:open={extraLargeOpen}
          title="Extra Large Modal"
          size="xl"
        >
          <p>This is an extra large modal. Best for complex interfaces or data-heavy content.</p>
          <p>It provides maximum content space while still feeling like a modal dialog.</p>
          <p>Ideal for dashboards, detailed forms, or content that needs lots of space.</p>
          <p>The large size ensures comfortable reading and interaction.</p>
        </ThemedModal>
      </div>
      
      <script>
        let smallOpen = false;
        let mediumOpen = false;
        let largeOpen = false;
        let extraLargeOpen = false;
      </script>
    `
  })
};

// Variant styles
export const Variants: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => ({
    Component: ThemedModal,
    template: `
      <div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding: 2rem;">
          <ThemedButton 
            variant="primary" 
            on:click={() => defaultOpen = true}
          >
            Default Modal
          </ThemedButton>
          <ThemedButton 
            variant="secondary" 
            on:click={() => settingsOpen = true}
          >
            Settings Modal
          </ThemedButton>
          <ThemedButton 
            variant="accent" 
            on:click={() => terminalOpen = true}
          >
            Terminal Modal
          </ThemedButton>
          <ThemedButton 
            variant="info" 
            on:click={() => voiceOpen = true}
          >
            Voice Modal
          </ThemedButton>
        </div>
        
        <ThemedModal 
          bind:open={defaultOpen}
          title="Default Modal"
          variant="default"
        >
          <p>This is the default modal variant with standard styling.</p>
          <p>It uses the current theme colors and provides a clean, professional appearance.</p>
        </ThemedModal>
        
        <ThemedModal 
          bind:open={settingsOpen}
          title="Settings Configuration"
          variant="settings"
          size="lg"
        >
          <p>This is the settings modal variant with enhanced backdrop blur and transparency.</p>
          <p>Perfect for configuration dialogs and preference panels.</p>
          <div style="margin-top: 1rem; padding: 1rem; background: var(--color-surface-secondary); border-radius: var(--border-radius-md);">
            <h4>Example Settings</h4>
            <p>Theme: Dark Mode</p>
            <p>Voice Commands: Enabled</p>
            <p>Auto-save: Every 30 seconds</p>
          </div>
        </ThemedModal>
        
        <ThemedModal 
          bind:open={terminalOpen}
          title="Terminal Interface"
          variant="terminal"
          size="lg"
        >
          <p style="color: var(--color-accent); font-family: var(--font-family-mono);">
            This is the terminal modal variant with monospace font and terminal aesthetics.
          </p>
          <div style="background: #000; padding: 1rem; border-radius: var(--border-radius-sm); margin-top: 1rem; font-family: var(--font-family-mono); color: var(--color-accent);">
            <p>$ voice-terminal --status</p>
            <p>Voice recognition: ACTIVE</p>
            <p>Audio input: Default microphone</p>
            <p>Model: gpt-4</p>
            <p>Status: Ready for commands</p>
          </div>
        </ThemedModal>
        
        <ThemedModal 
          bind:open={voiceOpen}
          title="Voice Command Center"
          variant="voice"
          size="md"
        >
          <p>This is the voice modal variant with gradient backgrounds and voice-specific styling.</p>
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
            <div style="padding: 1rem; background: linear-gradient(45deg, var(--color-primary), var(--color-accent)); border-radius: var(--border-radius-md); color: white;">
              <h4>🎤 Voice Status: Listening</h4>
              <p>Speak your command now...</p>
            </div>
            <div style="text-align: center;">
              <ThemedButton variant="accent" size="lg">🔊 Start Voice Command</ThemedButton>
            </div>
          </div>
        </ThemedModal>
      </div>
      
      <script>
        let defaultOpen = false;
        let settingsOpen = false;
        let terminalOpen = false;
        let voiceOpen = false;
      </script>
    `
  })
};

// Voice terminal specific examples
export const VoiceTerminalModals: Story = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'Dark' }
  },
  render: () => ({
    Component: ThemedModal,
    template: `
      <div style="padding: 2rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
          <ThemedButton 
            variant="accent" 
            size="lg"
            on:click={() => voiceConfigOpen = true}
          >
            🎤 Voice Configuration
          </ThemedButton>
          <ThemedButton 
            variant="primary" 
            size="lg"
            on:click={() => transcriptionOpen = true}
          >
            📝 Transcription History
          </ThemedButton>
          <ThemedButton 
            variant="warning" 
            size="lg"
            on:click={() => settingsOpen = true}
          >
            ⚙️ Terminal Settings
          </ThemedButton>
          <ThemedButton 
            variant="info" 
            size="lg"
            on:click={() => helpOpen = true}
          >
            ❓ Command Help
          </ThemedButton>
        </div>
        
        <!-- Voice Configuration Modal -->
        <ThemedModal 
          bind:open={voiceConfigOpen}
          title="🎤 Voice Configuration"
          variant="voice"
          size="lg"
        >
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div style="padding: 1rem; background: var(--color-surface); border-radius: var(--border-radius-md); border: 1px solid var(--color-border);">
              <h4 style="margin-bottom: 0.5rem;">Audio Settings</h4>
              <p>Microphone: Default (Built-in)</p>
              <p>Sample Rate: 44.1 kHz</p>
              <p>Channels: Mono</p>
            </div>
            
            <div style="padding: 1rem; background: var(--color-surface); border-radius: var(--border-radius-md); border: 1px solid var(--color-border);">
              <h4 style="margin-bottom: 0.5rem;">Voice Recognition</h4>
              <p>Provider: OpenAI Whisper</p>
              <p>Language: English (US)</p>
              <p>Confidence Threshold: 0.8</p>
            </div>
            
            <div style="text-align: center;">
              <ThemedButton variant="accent">Test Voice Recognition</ThemedButton>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="secondary" on:click={() => voiceConfigOpen = false}>Cancel</ThemedButton>
            <ThemedButton variant="primary">Save Settings</ThemedButton>
          </svelte:fragment>
        </ThemedModal>
        
        <!-- Transcription History Modal -->
        <ThemedModal 
          bind:open={transcriptionOpen}
          title="📝 Transcription History"
          variant="default"
          size="xl"
        >
          <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto;">
            <div style="padding: 1rem; background: var(--color-surface); border-radius: var(--border-radius-md); border-left: 4px solid var(--color-accent);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong>2024-01-15 14:30:22</strong>
                <span style="color: var(--color-text-muted); font-size: 0.875rem;">Voice Command</span>
              </div>
              <p>"Create a new React component for the dashboard"</p>
            </div>
            
            <div style="padding: 1rem; background: var(--color-surface); border-radius: var(--border-radius-md); border-left: 4px solid var(--color-primary);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong>2024-01-15 14:28:15</strong>
                <span style="color: var(--color-text-muted); font-size: 0.875rem;">Terminal Command</span>
              </div>
              <p>"Run the development server and open browser"</p>
            </div>
            
            <div style="padding: 1rem; background: var(--color-surface); border-radius: var(--border-radius-md); border-left: 4px solid var(--color-success);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong>2024-01-15 14:25:03</strong>
                <span style="color: var(--color-text-muted); font-size: 0.875rem;">Query</span>
              </div>
              <p>"How do I implement voice recognition in JavaScript?"</p>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="secondary">Clear History</ThemedButton>
            <ThemedButton variant="primary">Export</ThemedButton>
          </svelte:fragment>
        </ThemedModal>
        
        <!-- Terminal Settings Modal -->
        <ThemedModal 
          bind:open={settingsOpen}
          title="⚙️ Terminal Settings"
          variant="settings"
          size="lg"
        >
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div>
              <h4 style="margin-bottom: 1rem;">Appearance</h4>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <label style="display: flex; justify-content: space-between; align-items: center;">
                  Theme Mode
                  <select style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--border-radius-sm); padding: 0.5rem;">
                    <option>Dark</option>
                    <option>Light</option>
                    <option>Auto</option>
                  </select>
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                  Font Size
                  <select style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--border-radius-sm); padding: 0.5rem;">
                    <option>Small</option>
                    <option>Medium</option>
                    <option>Large</option>
                  </select>
                </label>
              </div>
            </div>
            
            <div>
              <h4 style="margin-bottom: 1rem;">Behavior</h4>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" checked />
                  Auto-save commands
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" checked />
                  Voice feedback
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" />
                  Debug mode
                </label>
              </div>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="secondary" on:click={() => settingsOpen = false}>Cancel</ThemedButton>
            <ThemedButton variant="primary">Apply Settings</ThemedButton>
          </svelte:fragment>
        </ThemedModal>
        
        <!-- Help Modal -->
        <ThemedModal 
          bind:open={helpOpen}
          title="❓ Voice Terminal Help"
          variant="terminal"
          size="lg"
        >
          <div style="font-family: var(--font-family-mono); color: var(--color-accent);">
            <div style="background: #000; padding: 1rem; border-radius: var(--border-radius-sm); margin-bottom: 1rem;">
              <p>VOICE TERMINAL v2.0 - Command Reference</p>
              <p>========================================</p>
              <p></p>
              <p>VOICE COMMANDS:</p>
              <p>  "start recording"     - Begin voice input</p>
              <p>  "stop recording"      - End voice input</p>
              <p>  "clear terminal"      - Clear command history</p>
              <p>  "run [command]"       - Execute terminal command</p>
              <p>  "save session"        - Save current session</p>
              <p></p>
              <p>KEYBOARD SHORTCUTS:</p>
              <p>  Ctrl+R               - Start/stop recording</p>
              <p>  Ctrl+L               - Clear terminal</p>
              <p>  Ctrl+S               - Save session</p>
              <p>  Ctrl+?               - Show this help</p>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="accent" on:click={() => helpOpen = false}>Got it!</ThemedButton>
          </svelte:fragment>
        </ThemedModal>
      </div>
      
      <script>
        let voiceConfigOpen = false;
        let transcriptionOpen = false;
        let settingsOpen = false;
        let helpOpen = false;
      </script>
    `
  })
};

// Interactive example
export const Interactive: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => ({
    Component: ThemedModal,
    template: `
      <div style="padding: 2rem; text-align: center;">
        <h2 style="color: var(--color-text); margin-bottom: 2rem;">Interactive Modal Demo</h2>
        
        <ThemedButton 
          variant="accent" 
          size="lg"
          on:click={() => interactiveOpen = true}
        >
          Open Interactive Modal
        </ThemedButton>
        
        <ThemedModal 
          bind:open={interactiveOpen}
          title="Interactive Demo"
          variant="voice"
          size="md"
        >
          <div style="text-align: center;">
            <p style="margin-bottom: 1.5rem;">This modal demonstrates interactive behavior.</p>
            
            <div style="display: flex; flex-direction: column; gap: 1rem; align-items: center;">
              <ThemedButton 
                variant="primary"
                on:click={() => alert('Primary action triggered!')}
              >
                Primary Action
              </ThemedButton>
              
              <ThemedButton 
                variant="secondary"
                on:click={() => alert('Secondary action triggered!')}
              >
                Secondary Action
              </ThemedButton>
              
              <ThemedButton 
                variant="accent"
                on:click={() => {
                  interactiveOpen = false;
                  setTimeout(() => {
                    alert('Modal closed and action executed!');
                  }, 300);
                }}
              >
                Close & Execute
              </ThemedButton>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton 
              variant="error" 
              on:click={() => interactiveOpen = false}
            >
              Close
            </ThemedButton>
          </svelte:fragment>
        </ThemedModal>
      </div>
      
      <script>
        let interactiveOpen = false;
      </script>
    `
  })
};

// Accessibility story
export const Accessibility: Story = {
  parameters: {
    layout: 'centered',
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            options: { noScroll: true }
          },
          {
            id: 'dialog-aria-modal',
            options: { noScroll: true }
          }
        ]
      }
    }
  },
  render: () => ({
    Component: ThemedModal,
    template: `
      <div>
        <ThemedButton 
          variant="primary"
          on:click={() => accessibleOpen = true}
          aria-label="Open accessible modal dialog"
        >
          Open Accessible Modal
        </ThemedButton>
        
        <ThemedModal 
          bind:open={accessibleOpen}
          title="Accessible Modal Dialog"
          variant="default"
          size="md"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <div id="modal-description">
            <p>This modal demonstrates proper accessibility features:</p>
            <ul style="margin: 1rem 0; padding-left: 1.5rem;">
              <li>Proper ARIA labels and descriptions</li>
              <li>Keyboard navigation support</li>
              <li>Focus management</li>
              <li>Screen reader compatibility</li>
              <li>High contrast support</li>
            </ul>
            <p>All interactive elements are properly labeled and accessible via keyboard.</p>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton 
              variant="secondary" 
              on:click={() => accessibleOpen = false}
              aria-label="Cancel and close modal"
            >
              Cancel
            </ThemedButton>
            <ThemedButton 
              variant="primary"
              aria-label="Confirm action and close modal"
              on:click={() => {
                accessibleOpen = false;
                alert('Action confirmed!');
              }}
            >
              Confirm
            </ThemedButton>
          </svelte:fragment>
        </ThemedModal>
      </div>
      
      <script>
        let accessibleOpen = false;
      </script>
    `
  })
};