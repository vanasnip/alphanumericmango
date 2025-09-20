import type { Meta, StoryObj } from '@storybook/svelte';
import ThemedCard from './ThemedCard.svelte';
import ThemedButton from './ThemedButton.svelte';

const meta: Meta<ThemedCard> = {
  title: 'Components/ThemedCard',
  component: ThemedCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A themed card component that integrates with the voice terminal theme system. Built on top of Flowbite Svelte Card with custom theming, variants, and interactive capabilities.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Card size variant affecting padding'
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'elevated', 'outlined', 'filled', 'terminal', 'voice', 'settings'],
      description: 'Card style variant'
    },
    padding: {
      control: { type: 'boolean' },
      description: 'Enable/disable card padding'
    },
    shadow: {
      control: { type: 'boolean' },
      description: 'Enable/disable card shadow'
    },
    border: {
      control: { type: 'boolean' },
      description: 'Enable/disable card border'
    },
    rounded: {
      control: { type: 'boolean' },
      description: 'Enable/disable rounded corners'
    },
    clickable: {
      control: { type: 'boolean' },
      description: 'Make card clickable with hover effects'
    },
    href: {
      control: { type: 'text' },
      description: 'URL to navigate to when clicked'
    },
    title: {
      control: { type: 'text' },
      description: 'Card title text'
    },
    subtitle: {
      control: { type: 'text' },
      description: 'Card subtitle text'
    },
    image: {
      control: { type: 'text' },
      description: 'Image URL for card header'
    },
    imageAlt: {
      control: { type: 'text' },
      description: 'Alt text for card image'
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

// Basic card stories
export const Default: Story = {
  args: {
    title: 'Default Card',
    subtitle: 'A simple card with default styling',
    size: 'md',
    variant: 'default'
  },
  render: (args) => ({
    Component: ThemedCard,
    props: args,
    slots: {
      default: `
        <p>This is a default themed card component. It integrates seamlessly with the voice terminal theme system and provides a clean, consistent interface.</p>
        <p>Cards can contain any content and are perfect for displaying information in an organized, visually appealing way.</p>
      `
    }
  })
};

export const WithImage: Story = {
  args: {
    title: 'Card with Image',
    subtitle: 'Demonstrating image header functionality',
    image: 'https://via.placeholder.com/400x200/3B82F6/FFFFFF?text=Voice+Terminal',
    imageAlt: 'Voice Terminal Interface',
    size: 'md',
    variant: 'default'
  },
  render: (args) => ({
    Component: ThemedCard,
    props: args,
    slots: {
      default: `
        <p>This card includes an image header that spans the full width of the card.</p>
        <p>The image is automatically sized and positioned for optimal visual impact.</p>
      `
    }
  })
};

export const WithFooter: Story = {
  args: {
    title: 'Card with Footer',
    subtitle: 'Demonstrating footer slot functionality',
    size: 'md',
    variant: 'default'
  },
  render: (args) => ({
    Component: ThemedCard,
    props: args,
    slots: {
      default: `
        <p>This card demonstrates the footer slot functionality with action buttons.</p>
        <p>The footer provides a dedicated space for actions and controls.</p>
      `,
      footer: `
        <div style="display: flex; gap: 0.75rem;">
          <ThemedButton variant="primary" size="sm">Primary Action</ThemedButton>
          <ThemedButton variant="secondary" size="sm">Secondary Action</ThemedButton>
        </div>
      `
    }
  })
};

// Size variations
export const Sizes: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedCard,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
        <ThemedCard 
          size="xs" 
          title="Extra Small"
          subtitle="Minimal padding"
        >
          <p>Extra small card with minimal padding. Good for compact information display.</p>
        </ThemedCard>
        
        <ThemedCard 
          size="sm" 
          title="Small"
          subtitle="Small padding"
        >
          <p>Small card with reduced padding. Suitable for sidebar widgets or summary cards.</p>
        </ThemedCard>
        
        <ThemedCard 
          size="md" 
          title="Medium"
          subtitle="Standard padding"
        >
          <p>Medium card with standard padding. The default size for most use cases.</p>
        </ThemedCard>
        
        <ThemedCard 
          size="lg" 
          title="Large"
          subtitle="Generous padding"
        >
          <p>Large card with generous padding. Perfect for featured content or detailed information.</p>
        </ThemedCard>
        
        <ThemedCard 
          size="xl" 
          title="Extra Large"
          subtitle="Maximum padding"
        >
          <p>Extra large card with maximum padding. Ideal for hero sections or prominent content areas.</p>
        </ThemedCard>
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
    Component: ThemedCard,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
        <ThemedCard 
          variant="default" 
          title="Default Card"
          subtitle="Standard styling"
        >
          <p>Default card variant with standard theme colors and subtle shadow.</p>
        </ThemedCard>
        
        <ThemedCard 
          variant="elevated" 
          title="Elevated Card"
          subtitle="Enhanced shadow"
        >
          <p>Elevated variant with enhanced shadow and no border for a floating effect.</p>
        </ThemedCard>
        
        <ThemedCard 
          variant="outlined" 
          title="Outlined Card"
          subtitle="Border emphasis"
        >
          <p>Outlined variant with prominent border and transparent background.</p>
        </ThemedCard>
        
        <ThemedCard 
          variant="filled" 
          title="Filled Card"
          subtitle="Primary color background"
        >
          <p>Filled variant with primary color background and inverse text colors.</p>
        </ThemedCard>
        
        <ThemedCard 
          variant="terminal" 
          title="Terminal Card"
          subtitle="Monospace aesthetics"
        >
          <p>Terminal variant with monospace font, dark background, and accent color glow.</p>
        </ThemedCard>
        
        <ThemedCard 
          variant="voice" 
          title="Voice Card"
          subtitle="Gradient styling"
        >
          <p>Voice variant with gradient backgrounds and voice-specific styling elements.</p>
        </ThemedCard>
        
        <ThemedCard 
          variant="settings" 
          title="Settings Card"
          subtitle="Backdrop blur effect"
        >
          <p>Settings variant with backdrop blur and semi-transparent styling.</p>
        </ThemedCard>
      </div>
    `
  })
};

// Interactive cards
export const Interactive: Story = {
  parameters: {
    layout: 'padded'
  },
  render: () => ({
    Component: ThemedCard,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
        <ThemedCard 
          clickable
          title="Clickable Card"
          subtitle="Click to interact"
          on:click={() => alert('Card clicked!')}
        >
          <p>This card is clickable and shows hover effects. Click anywhere on the card to trigger an action.</p>
        </ThemedCard>
        
        <ThemedCard 
          clickable
          variant="elevated"
          title="Hover Effects"
          subtitle="Interactive elevation"
          on:click={() => alert('Elevated card clicked!')}
        >
          <p>This elevated card has enhanced hover effects with smooth transitions and shadow changes.</p>
        </ThemedCard>
        
        <ThemedCard 
          href="#"
          title="Link Card"
          subtitle="Navigate on click"
          clickable
        >
          <p>This card acts as a link and will navigate to the specified URL when clicked.</p>
        </ThemedCard>
        
        <ThemedCard 
          clickable
          variant="voice"
          title="Voice Action"
          subtitle="Voice command trigger"
          on:click={() => alert('Voice command triggered!')}
        >
          <p>🎤 Click to activate voice command mode and start recording your voice input.</p>
        </ThemedCard>
      </div>
    `
  })
};

// Voice terminal specific examples
export const VoiceTerminalCards: Story = {
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'Dark' }
  },
  render: () => ({
    Component: ThemedCard,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
        <!-- Voice Status Card -->
        <ThemedCard 
          variant="voice" 
          title="🎤 Voice Status"
          subtitle="Current voice recognition state"
          size="lg"
        >
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Status:</span>
              <span style="color: var(--color-success); font-weight: bold;">LISTENING</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Model:</span>
              <span>GPT-4 Turbo</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Language:</span>
              <span>English (US)</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Confidence:</span>
              <span style="color: var(--color-accent);">98%</span>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="accent" size="sm">🔊 Start Recording</ThemedButton>
            <ThemedButton variant="secondary" size="sm">⏹️ Stop</ThemedButton>
          </svelte:fragment>
        </ThemedCard>
        
        <!-- Terminal Session Card -->
        <ThemedCard 
          variant="terminal" 
          title="$ Terminal Session"
          subtitle="Active command session"
          size="lg"
        >
          <div style="font-family: var(--font-family-mono); color: var(--color-accent); background: #000; padding: 1rem; border-radius: var(--border-radius-sm); margin: 1rem 0;">
            <p>$ voice-terminal --status</p>
            <p>Voice recognition: ACTIVE</p>
            <p>Commands executed: 47</p>
            <p>Session time: 00:23:45</p>
            <p>Last command: "npm run dev"</p>
            <p style="color: var(--color-success);">Ready for input...</p>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="accent" size="sm">📝 History</ThemedButton>
            <ThemedButton variant="secondary" size="sm">🔄 Clear</ThemedButton>
          </svelte:fragment>
        </ThemedCard>
        
        <!-- Quick Actions Card -->
        <ThemedCard 
          variant="settings" 
          title="⚡ Quick Actions"
          subtitle="Frequently used commands"
          size="lg"
        >
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <ThemedButton variant="primary" size="sm">🚀 Start Dev</ThemedButton>
            <ThemedButton variant="success" size="sm">✅ Run Tests</ThemedButton>
            <ThemedButton variant="info" size="sm">📦 Build</ThemedButton>
            <ThemedButton variant="warning" size="sm">🔧 Lint</ThemedButton>
            <ThemedButton variant="secondary" size="sm">📄 Docs</ThemedButton>
            <ThemedButton variant="accent" size="sm">🎯 Deploy</ThemedButton>
          </div>
        </ThemedCard>
        
        <!-- Recent Transcriptions Card -->
        <ThemedCard 
          variant="default" 
          title="📝 Recent Transcriptions"
          subtitle="Latest voice commands"
          size="lg"
        >
          <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 200px; overflow-y: auto;">
            <div style="padding: 0.75rem; background: var(--color-surface-secondary); border-radius: var(--border-radius-sm); border-left: 3px solid var(--color-accent);">
              <div style="font-size: 0.875rem; color: var(--color-text-muted);">2 minutes ago</div>
              <div>"Start the development server"</div>
            </div>
            <div style="padding: 0.75rem; background: var(--color-surface-secondary); border-radius: var(--border-radius-sm); border-left: 3px solid var(--color-primary);">
              <div style="font-size: 0.875rem; color: var(--color-text-muted);">5 minutes ago</div>
              <div>"Create a new component for the dashboard"</div>
            </div>
            <div style="padding: 0.75rem; background: var(--color-surface-secondary); border-radius: var(--border-radius-sm); border-left: 3px solid var(--color-success);">
              <div style="font-size: 0.875rem; color: var(--color-text-muted);">8 minutes ago</div>
              <div>"Run all unit tests"</div>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="secondary" size="sm">View All</ThemedButton>
            <ThemedButton variant="primary" size="sm">Export</ThemedButton>
          </svelte:fragment>
        </ThemedCard>
        
        <!-- System Status Card -->
        <ThemedCard 
          variant="elevated" 
          title="🖥️ System Status"
          subtitle="Current system information"
          size="lg"
        >
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <h5 style="margin-bottom: 0.5rem; color: var(--color-text);">Performance</h5>
              <div style="font-size: 0.875rem; color: var(--color-text-muted);">
                <p>CPU: 23%</p>
                <p>Memory: 1.2GB</p>
                <p>Disk: 45GB free</p>
              </div>
            </div>
            <div>
              <h5 style="margin-bottom: 0.5rem; color: var(--color-text);">Network</h5>
              <div style="font-size: 0.875rem; color: var(--color-text-muted);">
                <p>Status: Connected</p>
                <p>Speed: 100 Mbps</p>
                <p>Latency: 12ms</p>
              </div>
            </div>
          </div>
          
          <svelte:fragment slot="footer">
            <ThemedButton variant="info" size="sm">📊 Details</ThemedButton>
          </svelte:fragment>
        </ThemedCard>
        
        <!-- Configuration Card -->
        <ThemedCard 
          variant="outlined" 
          title="⚙️ Configuration"
          subtitle="Current settings overview"
          size="lg"
          clickable
          on:click={() => alert('Opening configuration panel...')}
        >
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Theme:</span>
              <span style="color: var(--color-accent);">Dark Mode</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Voice Commands:</span>
              <span style="color: var(--color-success);">Enabled</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Auto-save:</span>
              <span style="color: var(--color-success);">Every 30s</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>Debug Mode:</span>
              <span style="color: var(--color-error);">Disabled</span>
            </div>
          </div>
          
          <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--color-text-muted);">
            Click anywhere on this card to open the full configuration panel.
          </p>
        </ThemedCard>
      </div>
    `
  })
};

// Layout examples
export const LayoutExamples: Story = {
  parameters: {
    layout: 'fullscreen'
  },
  render: () => ({
    Component: ThemedCard,
    template: `
      <div style="padding: 2rem;">
        <h2 style="color: var(--color-text); margin-bottom: 2rem;">Card Layout Examples</h2>
        
        <!-- Dashboard Grid -->
        <section style="margin-bottom: 3rem;">
          <h3 style="color: var(--color-text); margin-bottom: 1rem;">Dashboard Grid Layout</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
            <ThemedCard variant="voice" title="Active Sessions" subtitle="2 users online">
              <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 2rem; color: var(--color-accent); margin-bottom: 0.5rem;">🎤</div>
                <div style="font-size: 1.5rem; font-weight: bold;">2</div>
                <div style="font-size: 0.875rem; color: var(--color-text-muted);">Active voice sessions</div>
              </div>
            </ThemedCard>
            
            <ThemedCard variant="terminal" title="Commands Today" subtitle="47 executed">
              <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 2rem; color: var(--color-accent); margin-bottom: 0.5rem;">⚡</div>
                <div style="font-size: 1.5rem; font-weight: bold;">47</div>
                <div style="font-size: 0.875rem; color: var(--color-text-muted);">Commands executed</div>
              </div>
            </ThemedCard>
            
            <ThemedCard variant="elevated" title="Success Rate" subtitle="98.2% accuracy">
              <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 2rem; color: var(--color-success); margin-bottom: 0.5rem;">✅</div>
                <div style="font-size: 1.5rem; font-weight: bold;">98.2%</div>
                <div style="font-size: 0.875rem; color: var(--color-text-muted);">Recognition accuracy</div>
              </div>
            </ThemedCard>
          </div>
        </section>
        
        <!-- Feature Cards -->
        <section style="margin-bottom: 3rem;">
          <h3 style="color: var(--color-text); margin-bottom: 1rem;">Feature Cards</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <ThemedCard 
              variant="default" 
              title="Voice Recognition"
              image="https://via.placeholder.com/300x150/3B82F6/FFFFFF?text=Voice+AI"
              imageAlt="Voice Recognition"
              clickable
            >
              <p>Advanced voice recognition powered by OpenAI Whisper for accurate transcription.</p>
              <svelte:fragment slot="footer">
                <ThemedButton variant="primary" size="sm">Learn More</ThemedButton>
              </svelte:fragment>
            </ThemedCard>
            
            <ThemedCard 
              variant="default" 
              title="Terminal Integration"
              image="https://via.placeholder.com/300x150/8B5CF6/FFFFFF?text=Terminal"
              imageAlt="Terminal Integration"
              clickable
            >
              <p>Seamless integration with your terminal for voice-controlled command execution.</p>
              <svelte:fragment slot="footer">
                <ThemedButton variant="secondary" size="sm">Explore</ThemedButton>
              </svelte:fragment>
            </ThemedCard>
            
            <ThemedCard 
              variant="default" 
              title="Smart Commands"
              image="https://via.placeholder.com/300x150/10B981/FFFFFF?text=AI+Commands"
              imageAlt="Smart Commands"
              clickable
            >
              <p>AI-powered command interpretation and suggestion system for enhanced productivity.</p>
              <svelte:fragment slot="footer">
                <ThemedButton variant="success" size="sm">Try Now</ThemedButton>
              </svelte:fragment>
            </ThemedCard>
          </div>
        </section>
        
        <!-- Settings Panel -->
        <section>
          <h3 style="color: var(--color-text); margin-bottom: 1rem;">Settings Panel Layout</h3>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
            <ThemedCard variant="settings" title="General Settings" size="lg">
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <label style="display: flex; justify-content: space-between; align-items: center;">
                  Theme Mode
                  <select style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--border-radius-sm); padding: 0.5rem;">
                    <option>Dark</option>
                    <option>Light</option>
                    <option>Auto</option>
                  </select>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" checked />
                  Enable voice commands
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" checked />
                  Auto-save sessions
                </label>
              </div>
              <svelte:fragment slot="footer">
                <ThemedButton variant="primary">Save Changes</ThemedButton>
              </svelte:fragment>
            </ThemedCard>
            
            <ThemedCard variant="outlined" title="Quick Stats" size="lg">
              <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: center;">
                <div>
                  <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-accent);">156</div>
                  <div style="font-size: 0.875rem; color: var(--color-text-muted);">Total Sessions</div>
                </div>
                <div>
                  <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-success);">2.3h</div>
                  <div style="font-size: 0.875rem; color: var(--color-text-muted);">Today's Usage</div>
                </div>
                <div>
                  <div style="font-size: 1.25rem; font-weight: bold; color: var(--color-primary);">94%</div>
                  <div style="font-size: 0.875rem; color: var(--color-text-muted);">Accuracy Rate</div>
                </div>
              </div>
            </ThemedCard>
          </div>
        </section>
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
    Component: ThemedCard,
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        <ThemedCard 
          title="Accessible Card"
          subtitle="Proper ARIA labeling"
          clickable
          role="button"
          tabindex="0"
          aria-label="Voice command card - click to activate voice recognition"
          on:click={() => alert('Voice recognition activated!')}
        >
          <p>This card demonstrates proper accessibility features:</p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Keyboard navigation support</li>
            <li>Screen reader compatibility</li>
            <li>High contrast support</li>
            <li>Focus indicators</li>
          </ul>
          
          <svelte:fragment slot="footer">
            <ThemedButton 
              variant="primary" 
              size="sm"
              aria-label="Start voice recognition session"
            >
              🎤 Start Voice
            </ThemedButton>
          </svelte:fragment>
        </ThemedCard>
        
        <ThemedCard 
          title="Semantic Structure"
          subtitle="Proper heading hierarchy"
          variant="elevated"
        >
          <div>
            <h4 style="margin-bottom: 0.5rem;">Features</h4>
            <p>This card uses proper semantic HTML structure with appropriate heading levels and landmarks.</p>
            <h5 style="margin: 0.75rem 0 0.25rem 0;">Accessibility Features:</h5>
            <ul style="margin: 0; padding-left: 1.5rem;">
              <li>Semantic HTML elements</li>
              <li>Proper color contrast ratios</li>
              <li>Keyboard-friendly interactions</li>
            </ul>
          </div>
        </ThemedCard>
        
        <ThemedCard 
          title="Focus Management"
          subtitle="Keyboard navigation ready"
          variant="outlined"
          clickable
          on:click={() => alert('Card focused and activated!')}
        >
          <p>This card properly manages focus states and provides visual feedback for keyboard users.</p>
          <p>Use Tab to navigate and Enter/Space to activate.</p>
          
          <svelte:fragment slot="footer">
            <ThemedButton 
              variant="secondary" 
              size="sm"
              aria-describedby="help-text"
            >
              Help
            </ThemedButton>
            <div id="help-text" style="display: none;">Provides contextual help information</div>
          </svelte:fragment>
        </ThemedCard>
      </div>
    `
  })
};