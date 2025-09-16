import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import MessageBubble from './MessageBubble';
import type { MessageBubbleProps } from './MessageBubble';

// Sample avatar images (using placeholder service)
const userAvatarSrc = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face';
const agentAvatarSrc = 'https://images.unsplash.com/photo-1545996124-0501ebae84d0?w=100&h=100&fit=crop&crop=face';

const meta = {
  title: 'Components/MessageBubble',
  component: MessageBubble,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A chat message bubble component with support for user and agent messages, avatars, timestamps, and model badges.

## Features
- **User vs Agent styling**: Different shapes and alignments
- **Avatar support**: Images, initials, or default icons
- **Timestamps**: Formatted time display
- **Model badges**: For AI assistant identification
- **Theme awareness**: Adapts to light/dark themes
- **Animations**: Smooth entrance animations
- **Accessibility**: Full screen reader support

## Design Specifications
- **User messages**: Perfect pill shape (50% border-radius), right-aligned, neumorphic raised appearance
- **Agent messages**: Rounded rectangle (12px border-radius), left-aligned, subtle depth
- **Light mode**: User #FFFFFF with shadow, Agent #E4EBF1 with inset shadow
- **Dark mode**: User #2A2B2F with glow, Agent #222326 with subtle definition
- **Timestamps**: Inside message bubbles for cleaner visual hierarchy
- **Avatars**: User photos, Agent AI badges with model identification
        `
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['user', 'agent'],
      description: 'Message type (determines shape, alignment, and styling)'
    },
    content: {
      control: 'text',
      description: 'The message content'
    },
    avatar: {
      control: 'object',
      description: 'Avatar configuration (image, alt, initials)'
    },
    timestamp: {
      control: 'date',
      description: 'Timestamp to display inside the bubble'
    },
    isTyping: {
      control: 'boolean',
      description: 'Whether the message is currently being typed (for agent messages)'
    },
    status: {
      control: 'select',
      options: ['sending', 'sent', 'delivered', 'read'],
      description: 'Message status for user messages'
    },
    className: {
      control: 'text',
      description: 'Custom CSS class for the message container'
    }
  },
  args: {
    type: 'user',
    content: 'Hello, this is a message!',
    timestamp: new Date()
  }
} satisfies Meta<MessageBubbleProps>;

export default meta;
type Story = StoryObj<typeof meta>;

// Shape Distinction Showcase
export const ShapeComparison: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>Shape Distinction</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          User messages are perfect pills, Agent messages are rounded rectangles
        </p>
      </div>
      
      <MessageBubble
        type="user"
        content="Perfect pill shape - notice the completely rounded ends! This is a user message with a photo avatar."
        avatar={{
          image: userAvatarSrc,
          alt: 'User Profile'
        }}
        timestamp={new Date('2024-01-15T14:30:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Rounded rectangle shape - see the more subtle corner rounding? This is an agent message with an AI badge."
        timestamp={new Date('2024-01-15T14:31:00Z')}
      />
      
      <MessageBubble
        type="user"
        content="Short pill"
        avatar={{
          image: userAvatarSrc,
          alt: 'User Profile'
        }}
        timestamp={new Date('2024-01-15T14:32:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Short rectangle"
        timestamp={new Date('2024-01-15T14:33:00Z')}
      />
    </div>
  )
};

// Individual component demos
export const UserMessage: Story = {
  args: {
    type: 'user',
    content: 'Perfect pill shape with neumorphic depth!',
    avatar: {
      image: userAvatarSrc,
      alt: 'User Profile Picture'
    },
    timestamp: new Date('2024-01-15T14:30:00Z')
  }
};

export const AgentMessage: Story = {
  args: {
    type: 'agent',
    content: "Rounded rectangle with AI badge and subtle depth styling.",
    timestamp: new Date('2024-01-15T14:31:00Z')
  }
};

// Design System Showcase - Primary Story
export const DesignSystem: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '700px', padding: '1.5rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '16px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>MessageBubble Design System</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', margin: 0, lineHeight: 1.5 }}>
          A comprehensive chat interface with distinct visual language for user vs agent messages
        </p>
      </div>
      
      {/* Shape Comparison */}
      <div>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Shape Identity</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>User Messages</h4>
            <div style={{ width: '120px', height: '40px', backgroundColor: 'var(--color-user-bubble, #FFFFFF)', borderRadius: '20px', margin: '0 auto 0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', margin: 0 }}>Perfect Pills (50% radius)</p>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Agent Messages</h4>
            <div style={{ width: '120px', height: '40px', backgroundColor: 'var(--color-agent-bubble, #E4EBF1)', borderRadius: '12px', margin: '0 auto 0.5rem', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', margin: 0 }}>Rounded Rectangles (12px radius)</p>
          </div>
        </div>
      </div>
      
      {/* Live Examples */}
      <div>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Live Examples</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <MessageBubble
            type="user"
            content="Perfect pill with photo avatar and raised effect"
            avatar={{ image: userAvatarSrc, alt: 'User' }}
            timestamp={new Date('2024-01-15T10:00:00Z')}
          />
          
          <MessageBubble
            type="agent"
            content="Rounded rectangle with AI badge and subtle depth"
            timestamp={new Date('2024-01-15T10:00:30Z')}
          />
        </div>
      </div>
    </div>
  )
};

// Avatar variants
export const UserWithImageAvatar: Story = {
  args: {
    type: 'user',
    content: 'This message has an image avatar!',
    avatar: {
      image: userAvatarSrc,
      alt: 'User Profile Picture'
    },
    timestamp: new Date('2024-01-15T14:32:00Z')
  }
};

export const AgentWithImageAvatar: Story = {
  args: {
    type: 'agent',
    content: 'I also have a profile picture avatar.',
    timestamp: new Date('2024-01-15T14:33:00Z')
  }
};

export const NoAvatar: Story = {
  args: {
    type: 'user',
    content: 'This message has no avatar at all.',
    timestamp: new Date('2024-01-15T14:34:00Z')
  }
};

export const DefaultAvatarIcon: Story = {
  args: {
    type: 'agent',
    content: 'This message uses the default avatar icon.',
    timestamp: new Date('2024-01-15T14:35:00Z')
  }
};

// Avatar sizes
export const AvatarSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <MessageBubble
        type="user"
        content="Small avatar (28px)"
        avatar={{ initials: 'SM', alt: 'Small avatar' }}
        timestamp={new Date('2024-01-15T14:36:00Z')}
      />
      <MessageBubble
        type="user"
        content="Medium avatar (36px) - Default"
        avatar={{ initials: 'MD', alt: 'Medium avatar' }}
        timestamp={new Date('2024-01-15T14:37:00Z')}
      />
      <MessageBubble
        type="user"
        content="Large avatar (44px)"
        avatar={{ initials: 'LG', alt: 'Large avatar' }}
        timestamp={new Date('2024-01-15T14:38:00Z')}
      />
    </div>
  )
};

// AI Model Showcase
export const AIModelShowcase: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>AI Model Badges</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Different AI models with distinctive badge styling
        </p>
      </div>
      
      <MessageBubble
        type="agent"
        content="I'm Claude Sonnet, Anthropic's AI assistant. I excel at thoughtful analysis and creative problem-solving."
        timestamp={new Date('2024-01-15T14:39:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="I'm GPT-4 Turbo from OpenAI. I can help with a wide range of tasks from coding to creative writing."
        timestamp={new Date('2024-01-15T14:40:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="I'm Gemini Pro from Google. I'm designed to be helpful, harmless, and honest in all interactions."
        timestamp={new Date('2024-01-15T14:41:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Generic AI badge for custom or unspecified models."
        timestamp={new Date('2024-01-15T14:42:00Z')}
      />
    </div>
  )
};

// Timestamp Positioning Showcase
export const TimestampShowcase: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>Timestamp Positioning</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Timestamps appear inside message bubbles for cleaner visual hierarchy
        </p>
      </div>
      
      <MessageBubble
        type="user"
        content="Morning message - timestamp inside the pill bubble"
        avatar={{ image: userAvatarSrc, alt: 'User' }}
        timestamp={new Date('2024-01-15T09:15:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Afternoon message - timestamp inside the rectangular bubble"
        timestamp={new Date('2024-01-15T13:45:00Z')}
      />
      
      <MessageBubble
        type="user"
        content="Evening message with string timestamp format"
        avatar={{ image: userAvatarSrc, alt: 'User' }}
        timestamp={new Date('2024-01-15T22:30:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Message with timestamps disabled"
        timestamp={new Date('2024-01-15T14:30:00Z')}
      />
      
      <div style={{ 
        marginTop: '1rem', 
        padding: '1rem', 
        backgroundColor: 'var(--color-bg-tertiary)', 
        borderRadius: '8px',
        border: '1px solid var(--color-border-subtle)'
      }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', margin: 0 }}>
          <strong>Note:</strong> Timestamps are positioned inside bubbles to maintain clean visual flow and reduce UI clutter. They automatically format based on the provided Date object or timestamp string.
        </p>
      </div>
    </div>
  )
};

// Multi-line Content Showcase
export const MultiLineContent: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>Multi-line Content</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          How pill and rectangle shapes handle longer text content
        </p>
      </div>
      
      <MessageBubble
        type="user"
        content="This is a longer user message that spans multiple lines to demonstrate how the perfect pill shape maintains its rounded ends even with extended content. Notice how the shape remains consistent!"
        avatar={{ image: userAvatarSrc, alt: 'User' }}
        timestamp={new Date('2024-01-15T14:42:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="This is a much longer agent message that demonstrates how the rounded rectangle shape handles extended content. The text wraps properly within the bubble while maintaining readability and proper spacing. The component uses word-wrap and overflow-wrap to ensure that long words don't break the layout, and the max-width constraint ensures the bubbles don't become too wide on larger screens. Notice the subtle corner rounding compared to the user's pill shape."
        timestamp={new Date('2024-01-15T14:43:00Z')}
      />
    </div>
  )
};

// Code content
export const CodeContent: Story = {
  args: {
    type: 'agent',
    content: `Here's a code example:

function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`,
    timestamp: new Date('2024-01-15T14:43:00Z')
  }
};

// Rich content
export const RichContent: Story = {
  args: {
    type: 'agent',
    content: `Here's some rich content:

• List item one
• List item two with emphasis
• List item three

You can include links and other formatted content.`,
    timestamp: new Date('2024-01-15T14:44:00Z')
  }
};

// Realistic Conversation Showcase
export const RealisticConversation: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '650px', padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '12px' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>Realistic Conversation Flow</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Notice the clear visual distinction: pills vs rectangles, photos vs AI badges
        </p>
      </div>
      
      <MessageBubble
        type="user"
        content="Hey! Can you help me design a better user interface for my app?"
        avatar={{ image: userAvatarSrc, alt: 'Sarah Chen' }}
        timestamp={new Date('2024-01-15T14:45:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Absolutely! I'd love to help with your UI design. What kind of app are you working on, and what specific aspects of the interface are you looking to improve?"
        timestamp={new Date('2024-01-15T14:45:15Z')}
      />
      
      <MessageBubble
        type="user"
        content="It's a productivity app for teams. The main issues are:\n• Navigation feels cluttered\n• Too many buttons everywhere\n• Users get lost in the workflow"
        avatar={{ image: userAvatarSrc, alt: 'Sarah Chen' }}
        timestamp={new Date('2024-01-15T14:45:45Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Those are common but solvable problems! Here's my approach:\n\n1. Navigation Simplification\n- Use a sidebar with grouped sections\n- Implement breadcrumb navigation\n- Consider a command palette for power users\n\n2. Button Hierarchy\n- Primary actions should be prominent\n- Secondary actions can be in dropdown menus\n- Use icon-only buttons for common actions\n\n3. User Flow Optimization\n- Create clear visual paths between related tasks\n- Use progressive disclosure to reduce cognitive load\n- Add contextual help and onboarding\n\nWould you like me to elaborate on any of these points?"
        timestamp={new Date('2024-01-15T14:46:20Z')}
      />
      
      <MessageBubble
        type="user"
        content="This is exactly what I needed! Could you tell me more about progressive disclosure?"
        avatar={{ image: userAvatarSrc, alt: 'Sarah Chen' }}
        timestamp={new Date('2024-01-15T14:47:10Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Progressive disclosure is a technique where you show only the most important information first, then reveal additional details as users need them. For example:\n\n• Start with essential form fields, show advanced options on request\n• Use expandable sections for detailed settings\n• Implement step-by-step wizards for complex processes\n• Show summary views with drill-down capabilities\n\nThis reduces visual clutter and helps users focus on their immediate goals!"
        timestamp={new Date('2024-01-15T14:47:35Z')}
      />
    </div>
  )
};

// No animation
export const NoAnimation: Story = {
  args: {
    type: 'user',
    content: 'This message appears without animation.',
    avatar: {
      initials: 'NA'
    },
    timestamp: new Date('2024-01-15T14:47:00Z')
  }
};

// Interactive example
// Depth and Animation Showcase
export const DepthAnimation: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>Neumorphic Depth & Animation</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Subtle shadows create depth perception and smooth animations enhance UX
        </p>
      </div>
      
      <MessageBubble
        type="user"
        content="Pill shape with raised neumorphic effect - see the subtle outward shadow?"
        avatar={{ image: userAvatarSrc, alt: 'User' }}
        timestamp={new Date('2024-01-15T14:48:00Z')}
      />
      
      <MessageBubble
        type="agent"
        content="Rectangle with gentle inset shadow - notice the more subtle depth compared to user messages."
        timestamp={new Date('2024-01-15T14:48:15Z')}
      />
      
      <MessageBubble
        type="user"
        content="This message appears without animation"
        avatar={{ image: userAvatarSrc, alt: 'User' }}
        timestamp={new Date('2024-01-15T14:48:30Z')}
      />
    </div>
  )
};

export const Interactive: Story = {
  args: {
    type: 'agent',
    content: 'Click on this message bubble to see interaction! Hover effects and click handlers work seamlessly.',
    timestamp: new Date('2024-01-15T14:48:00Z')
  }
};

// Comprehensive Theme Showcase
export const ThemeShowcase: Story = {
  render: () => (
    <div style={{ padding: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>Theme Adaptation</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Toggle Storybook's theme switcher to see neumorphic depth adaptation
        </p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <MessageBubble
          type="user"
          content="Light mode: White pills with subtle shadows ✨"
          avatar={{ image: userAvatarSrc, alt: 'User' }}
          timestamp={new Date('2024-01-15T14:49:00Z')}
        />
        
        <MessageBubble
          type="agent"
          content="Light mode: Soft gray rectangles with inset shadows"
          timestamp={new Date('2024-01-15T14:49:15Z')}
        />
        
        <MessageBubble
          type="user"
          content="Dark mode: Dark pills with subtle glow effects 🌙"
          avatar={{ image: userAvatarSrc, alt: 'User' }}
          timestamp={new Date('2024-01-15T14:49:30Z')}
        />
        
        <MessageBubble
          type="agent"
          content="Dark mode: Slightly lighter rectangles with definition shadows"
          timestamp={new Date('2024-01-15T14:49:45Z')}
        />
      </div>
      
      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        backgroundColor: 'var(--color-bg-tertiary)', 
        borderRadius: '8px',
        border: '1px solid var(--color-border-subtle)'
      }}>
        <h4 style={{ color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>Theme Features:</h4>
        <ul style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', margin: 0, paddingLeft: '1.2rem' }}>
          <li>Neumorphic depth adapts to light/dark backgrounds</li>
          <li>Shadow directions optimize for visual hierarchy</li>
          <li>Model badges maintain high contrast in both themes</li>
          <li>Typography scales maintain readability across themes</li>
        </ul>
      </div>
    </div>
  )
};

// Error states and edge cases
export const EdgeCases: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <MessageBubble 
        type="user" 
        content="Empty initials (shows default icon)"
        avatar={{ initials: '' }}
        timestamp={new Date()}
      />
      
      <MessageBubble 
        type="user" 
        content="Long initials (truncated)"
        avatar={{ initials: 'verylongname' }}
        timestamp={new Date()}
      />
      
      <MessageBubble 
        type="agent" 
        content="Broken image URL (fallback behavior)"
        timestamp={new Date()}
      />
      
      <MessageBubble 
        type="user"
        content="No avatar, no timestamp - minimal message"
        timestamp={new Date()}
      />
    </div>
  )
};