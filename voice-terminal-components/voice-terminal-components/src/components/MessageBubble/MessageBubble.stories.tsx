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
- User messages: Pill shape (50% border radius), right-aligned, raised appearance
- Agent messages: Rounded rectangle (8-12px radius), left-aligned, neutral appearance
- Light mode: User #FFFFFF, Agent #E4EBF1
- Dark mode: User #2A2B2F, Agent #222326
        `
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    sender: {
      control: 'select',
      options: ['user', 'agent'],
      description: 'Who sent the message (determines alignment and styling)'
    },
    children: {
      control: 'text',
      description: 'The message content'
    },
    avatar: {
      control: 'object',
      description: 'Avatar configuration (src, alt, initials, size)'
    },
    timestamp: {
      control: 'date',
      description: 'Timestamp to display above the bubble'
    },
    modelBadge: {
      control: 'object',
      description: 'Model badge for AI messages'
    },
    showTimestamp: {
      control: 'boolean',
      description: 'Whether to show the timestamp'
    },
    animate: {
      control: 'boolean',
      description: 'Whether to animate the bubble entrance'
    },
    containerClassName: {
      control: 'text',
      description: 'Custom CSS class for the message container'
    },
    className: {
      control: 'text',
      description: 'Custom CSS class for the message bubble'
    }
  },
  args: {
    onClick: fn(),
    showTimestamp: true,
    animate: true
  }
} satisfies Meta<MessageBubbleProps>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic stories
export const UserMessage: Story = {
  args: {
    sender: 'user',
    children: 'Hey there! How are you doing today?',
    avatar: {
      initials: 'JD',
      alt: 'John Doe'
    },
    timestamp: new Date('2024-01-15T14:30:00Z')
  }
};

export const AgentMessage: Story = {
  args: {
    sender: 'agent',
    children: "Hello! I'm doing well, thank you for asking. How can I help you today?",
    avatar: {
      initials: 'AI',
      alt: 'AI Assistant'
    },
    timestamp: new Date('2024-01-15T14:31:00Z'),
    modelBadge: {
      model: 'anthropic',
      label: 'Claude'
    }
  }
};

// Avatar variants
export const UserWithImageAvatar: Story = {
  args: {
    sender: 'user',
    children: 'This message has an image avatar!',
    avatar: {
      src: userAvatarSrc,
      alt: 'User Profile Picture'
    },
    timestamp: new Date('2024-01-15T14:32:00Z')
  }
};

export const AgentWithImageAvatar: Story = {
  args: {
    sender: 'agent',
    children: 'I also have a profile picture avatar.',
    avatar: {
      src: agentAvatarSrc,
      alt: 'AI Assistant Avatar'
    },
    timestamp: new Date('2024-01-15T14:33:00Z'),
    modelBadge: {
      model: 'openai',
      label: 'GPT-4'
    }
  }
};

export const NoAvatar: Story = {
  args: {
    sender: 'user',
    children: 'This message has no avatar at all.',
    timestamp: new Date('2024-01-15T14:34:00Z')
  }
};

export const DefaultAvatarIcon: Story = {
  args: {
    sender: 'agent',
    children: 'This message uses the default avatar icon.',
    avatar: {
      alt: 'Default AI Avatar'
    },
    timestamp: new Date('2024-01-15T14:35:00Z'),
    modelBadge: {
      model: 'gemini'
    }
  }
};

// Avatar sizes
export const AvatarSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <MessageBubble
        sender="user"
        avatar={{ initials: 'SM', size: 'sm', alt: 'Small avatar' }}
        timestamp={new Date('2024-01-15T14:36:00Z')}
      >
        Small avatar (28px)
      </MessageBubble>
      <MessageBubble
        sender="user"
        avatar={{ initials: 'MD', size: 'md', alt: 'Medium avatar' }}
        timestamp={new Date('2024-01-15T14:37:00Z')}
      >
        Medium avatar (36px) - Default
      </MessageBubble>
      <MessageBubble
        sender="user"
        avatar={{ initials: 'LG', size: 'lg', alt: 'Large avatar' }}
        timestamp={new Date('2024-01-15T14:38:00Z')}
      >
        Large avatar (44px)
      </MessageBubble>
    </div>
  )
};

// Model badges
export const ModelBadges: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI' }}
        timestamp={new Date('2024-01-15T14:39:00Z')}
        modelBadge={{ model: 'anthropic', label: 'Claude-3 Sonnet' }}
      >
        Message from Anthropic's Claude
      </MessageBubble>
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI' }}
        timestamp={new Date('2024-01-15T14:40:00Z')}
        modelBadge={{ model: 'openai', label: 'GPT-4 Turbo' }}
      >
        Message from OpenAI's GPT-4
      </MessageBubble>
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI' }}
        timestamp={new Date('2024-01-15T14:41:00Z')}
        modelBadge={{ model: 'gemini', label: 'Gemini Pro' }}
      >
        Message from Google's Gemini
      </MessageBubble>
    </div>
  )
};

// Timestamp variants
export const TimestampVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <MessageBubble
        sender="user"
        avatar={{ initials: 'U1' }}
        timestamp={new Date('2024-01-15T09:15:00Z')}
      >
        Morning message (9:15 AM)
      </MessageBubble>
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI' }}
        timestamp={new Date('2024-01-15T13:45:00Z')}
        modelBadge={{ model: 'anthropic' }}
      >
        Afternoon message (1:45 PM)
      </MessageBubble>
      <MessageBubble
        sender="user"
        avatar={{ initials: 'U2' }}
        timestamp="2024-01-15T22:30:00Z"
      >
        String timestamp (10:30 PM)
      </MessageBubble>
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI' }}
        showTimestamp={false}
        modelBadge={{ model: 'openai' }}
      >
        No timestamp shown
      </MessageBubble>
    </div>
  )
};

// Long content
export const LongContent: Story = {
  args: {
    sender: 'agent',
    children: `This is a much longer message that demonstrates how the MessageBubble component handles extended content. The text should wrap properly within the bubble while maintaining readability and proper spacing. The component uses word-wrap and overflow-wrap to ensure that long words don't break the layout, and the max-width constraint ensures the bubbles don't become too wide on larger screens.`,
    avatar: {
      initials: 'AI'
    },
    timestamp: new Date('2024-01-15T14:42:00Z'),
    modelBadge: {
      model: 'anthropic',
      label: 'Claude'
    }
  }
};

// Code content
export const CodeContent: Story = {
  args: {
    sender: 'agent',
    children: (
      <div>
        <p>Here's a code example:</p>
        <pre style={{ 
          backgroundColor: 'var(--color-bg-tertiary)', 
          padding: '8px', 
          borderRadius: '4px',
          fontSize: '0.875rem',
          overflow: 'auto'
        }}>
          <code>{`function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`}</code>
        </pre>
      </div>
    ),
    avatar: {
      initials: 'AI'
    },
    timestamp: new Date('2024-01-15T14:43:00Z'),
    modelBadge: {
      model: 'anthropic',
      label: 'Claude'
    }
  }
};

// Rich content
export const RichContent: Story = {
  args: {
    sender: 'agent',
    children: (
      <div>
        <p><strong>Here's some rich content:</strong></p>
        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
          <li>List item one</li>
          <li>List item two with <em>emphasis</em></li>
          <li>List item three</li>
        </ul>
        <p>You can include <a href="#" style={{ color: 'var(--color-text-bright)' }}>links</a> and other HTML elements.</p>
      </div>
    ),
    avatar: {
      initials: 'AI'
    },
    timestamp: new Date('2024-01-15T14:44:00Z'),
    modelBadge: {
      model: 'openai',
      label: 'GPT-4'
    }
  }
};

// Conversation flow
export const ConversationFlow: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '600px' }}>
      <MessageBubble
        sender="user"
        avatar={{ initials: 'JD', alt: 'John Doe' }}
        timestamp={new Date('2024-01-15T14:45:00Z')}
      >
        Can you help me understand React hooks?
      </MessageBubble>
      
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI', alt: 'AI Assistant' }}
        timestamp={new Date('2024-01-15T14:45:30Z')}
        modelBadge={{ model: 'anthropic', label: 'Claude' }}
      >
        Of course! React hooks are functions that let you use state and other React features in functional components.
      </MessageBubble>
      
      <MessageBubble
        sender="user"
        avatar={{ initials: 'JD', alt: 'John Doe' }}
        timestamp={new Date('2024-01-15T14:46:00Z')}
      >
        What's the difference between useState and useEffect?
      </MessageBubble>
      
      <MessageBubble
        sender="agent"
        avatar={{ initials: 'AI', alt: 'AI Assistant' }}
        timestamp={new Date('2024-01-15T14:46:30Z')}
        modelBadge={{ model: 'anthropic', label: 'Claude' }}
      >
        Great question! useState manages local component state, while useEffect handles side effects like API calls, subscriptions, or manual DOM updates.
      </MessageBubble>
    </div>
  )
};

// No animation
export const NoAnimation: Story = {
  args: {
    sender: 'user',
    children: 'This message appears without animation.',
    avatar: {
      initials: 'NA'
    },
    timestamp: new Date('2024-01-15T14:47:00Z'),
    animate: false
  }
};

// Interactive example
export const Interactive: Story = {
  args: {
    sender: 'agent',
    children: 'Click on this message bubble to see interaction!',
    avatar: {
      initials: 'AI'
    },
    timestamp: new Date('2024-01-15T14:48:00Z'),
    modelBadge: {
      model: 'anthropic'
    },
    onClick: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    style: { cursor: 'pointer' }
  }
};

// Theme demonstration
export const ThemeShowcase: Story = {
  render: () => (
    <div>
      <h3 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
        Light/Dark Theme Support
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <MessageBubble
          sender="user"
          avatar={{ initials: 'U', alt: 'User' }}
          timestamp={new Date('2024-01-15T14:49:00Z')}
        >
          User message adapts to current theme
        </MessageBubble>
        <MessageBubble
          sender="agent"
          avatar={{ initials: 'AI', alt: 'AI' }}
          timestamp={new Date('2024-01-15T14:49:30Z')}
          modelBadge={{ model: 'anthropic', label: 'Claude' }}
        >
          Agent message also adapts to theme colors
        </MessageBubble>
      </div>
      <p style={{ 
        marginTop: '1rem', 
        fontSize: '0.875rem', 
        color: 'var(--color-text-secondary)',
        fontStyle: 'italic'
      }}>
        Toggle between light and dark themes in Storybook to see the adaptation.
      </p>
    </div>
  )
};

// Error states and edge cases
export const EdgeCases: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <MessageBubble sender="user" avatar={{ initials: '' }}>
        Empty initials (shows default icon)
      </MessageBubble>
      
      <MessageBubble 
        sender="user" 
        avatar={{ initials: 'verylongname' }}
        timestamp="invalid-date"
      >
        Long initials (truncated) and invalid timestamp
      </MessageBubble>
      
      <MessageBubble sender="agent" avatar={{ src: 'broken-url.jpg', alt: 'Broken image' }}>
        Broken image URL (fallback behavior)
      </MessageBubble>
      
      <MessageBubble sender="user">
        No avatar, no timestamp - minimal message
      </MessageBubble>
    </div>
  )
};