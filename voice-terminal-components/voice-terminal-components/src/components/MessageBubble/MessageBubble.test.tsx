import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import MessageBubble from './MessageBubble';
import type { MessageBubbleProps } from './MessageBubble';

// Mock current date for consistent timestamp testing
const mockDate = new Date('2024-01-15T10:30:00Z');
vi.setSystemTime(mockDate);

describe('MessageBubble', () => {
  const defaultProps: MessageBubbleProps = {
    sender: 'user',
    children: 'Test message content'
  };

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<MessageBubble {...defaultProps} />);
      
      const message = screen.getByText('Test message content');
      expect(message).toBeInTheDocument();
      expect(message).toHaveAttribute('role', 'log');
      expect(message).toHaveAttribute('aria-live', 'polite');
    });

    it('renders children correctly', () => {
      render(
        <MessageBubble sender="user">
          <span>Child 1</span>
          <span>Child 2</span>
        </MessageBubble>
      );
      
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('applies custom className to bubble', () => {
      render(
        <MessageBubble {...defaultProps} className="custom-bubble-class" />
      );
      
      const message = screen.getByText('Test message content');
      expect(message).toHaveClass('custom-bubble-class');
    });

    it('applies custom containerClassName to container', () => {
      render(
        <MessageBubble 
          {...defaultProps} 
          containerClassName="custom-container-class"
          data-testid="message-container"
        />
      );
      
      // The container is the parent div, so we need to access it via the message
      const message = screen.getByText('Test message content');
      const container = message.closest('.messageContainer');
      expect(container).toHaveClass('custom-container-class');
    });
  });

  describe('Sender Variants', () => {
    it('renders user message with correct styling', () => {
      render(<MessageBubble sender="user">User message</MessageBubble>);
      
      const message = screen.getByText('User message');
      expect(message).toHaveClass('bubble-user');
      
      const container = message.closest('.messageContainer');
      expect(container).toHaveClass('container-user');
    });

    it('renders agent message with correct styling', () => {
      render(<MessageBubble sender="agent">Agent message</MessageBubble>);
      
      const message = screen.getByText('Agent message');
      expect(message).toHaveClass('bubble-agent');
      
      const container = message.closest('.messageContainer');
      expect(container).toHaveClass('container-agent');
    });

    it('applies different elevation for user vs agent', () => {
      const { rerender } = render(
        <MessageBubble sender="user">User message</MessageBubble>
      );
      
      let message = screen.getByText('User message');
      expect(message).toHaveClass('elevation-raised');
      
      rerender(<MessageBubble sender="agent">Agent message</MessageBubble>);
      message = screen.getByText('Agent message');
      expect(message).toHaveClass('elevation-recessed');
    });
  });

  describe('Avatar Display', () => {
    it('does not render avatar when not provided', () => {
      render(<MessageBubble {...defaultProps} />);
      
      const avatar = screen.queryByLabelText(/avatar/i);
      expect(avatar).not.toBeInTheDocument();
    });

    it('renders avatar with image source', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ src: '/test-avatar.jpg', alt: 'Test User' }}
        />
      );
      
      const avatar = screen.getByAltText('Test User');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', '/test-avatar.jpg');
      expect(avatar.tagName).toBe('IMG');
    });

    it('renders avatar with initials when no image provided', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'JD', alt: 'John Doe' }}
        />
      );
      
      const avatar = screen.getByLabelText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders default avatar icon when no image or initials', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ alt: 'Default avatar' }}
        />
      );
      
      const avatar = screen.getByLabelText('Default avatar');
      expect(avatar).toBeInTheDocument();
      
      const icon = avatar.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('limits initials to 2 characters and converts to uppercase', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'john doe' }}
        />
      );
      
      expect(screen.getByText('JO')).toBeInTheDocument();
    });

    it('applies different avatar sizes', () => {
      const { rerender } = render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'JD', size: 'sm' }}
        />
      );
      
      let avatar = screen.getByLabelText(/avatar/i);
      expect(avatar).toHaveClass('avatar-sm');
      
      rerender(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'JD', size: 'lg' }}
        />
      );
      avatar = screen.getByLabelText(/avatar/i);
      expect(avatar).toHaveClass('avatar-lg');
    });

    it('positions avatar correctly for user vs agent', () => {
      const { rerender } = render(
        <MessageBubble 
          sender="user"
          avatar={{ initials: 'U' }}
        >
          User message
        </MessageBubble>
      );
      
      let messageRow = screen.getByText('User message').closest('.messageRow');
      let avatarContainer = messageRow?.querySelector('.avatarContainer');
      let messageBubble = messageRow?.querySelector('.messageBubble');
      
      // For user messages, avatar should come after bubble in DOM
      expect(avatarContainer?.nextElementSibling).toBe(null);
      expect(messageBubble?.nextElementSibling).toBe(avatarContainer);
      
      rerender(
        <MessageBubble 
          sender="agent"
          avatar={{ initials: 'A' }}
        >
          Agent message
        </MessageBubble>
      );
      
      messageRow = screen.getByText('Agent message').closest('.messageRow');
      avatarContainer = messageRow?.querySelector('.avatarContainer');
      messageBubble = messageRow?.querySelector('.messageBubble');
      
      // For agent messages, avatar should come before bubble in DOM
      expect(avatarContainer?.nextElementSibling).toBe(messageBubble);
    });
  });

  describe('Timestamp Display', () => {
    it('does not show timestamp by default when not provided', () => {
      render(<MessageBubble {...defaultProps} />);
      
      const timestamp = screen.queryByRole('time');
      expect(timestamp).not.toBeInTheDocument();
    });

    it('shows timestamp when provided', () => {
      const testDate = new Date('2024-01-15T14:30:00Z');
      render(
        <MessageBubble {...defaultProps} timestamp={testDate} />
      );
      
      const timestamp = screen.getByRole('time');
      expect(timestamp).toBeInTheDocument();
      expect(timestamp).toHaveTextContent('2:30 PM');
      expect(timestamp).toHaveAttribute('datetime', testDate.toString());
    });

    it('formats string timestamps correctly', () => {
      render(
        <MessageBubble 
          {...defaultProps} 
          timestamp="2024-01-15T09:15:00Z" 
        />
      );
      
      const timestamp = screen.getByRole('time');
      expect(timestamp).toHaveTextContent('9:15 AM');
    });

    it('handles invalid timestamp gracefully', () => {
      render(
        <MessageBubble 
          {...defaultProps} 
          timestamp="invalid-date" 
        />
      );
      
      const timestamp = screen.getByRole('time');
      expect(timestamp).toHaveTextContent('invalid-date');
    });

    it('hides timestamp when showTimestamp is false', () => {
      render(
        <MessageBubble 
          {...defaultProps} 
          timestamp={new Date()}
          showTimestamp={false}
        />
      );
      
      const timestamp = screen.queryByRole('time');
      expect(timestamp).not.toBeInTheDocument();
    });

    it('applies correct alignment classes for user vs agent', () => {
      const testDate = new Date();
      const { rerender } = render(
        <MessageBubble 
          sender="user" 
          timestamp={testDate}
        >
          User message
        </MessageBubble>
      );
      
      let timestamp = screen.getByRole('time');
      expect(timestamp).toHaveClass('timestamp-user');
      
      rerender(
        <MessageBubble 
          sender="agent" 
          timestamp={testDate}
        >
          Agent message
        </MessageBubble>
      );
      timestamp = screen.getByRole('time');
      expect(timestamp).toHaveClass('timestamp-agent');
    });
  });

  describe('Model Badge Display', () => {
    it('does not show model badge for user messages', () => {
      render(
        <MessageBubble 
          sender="user"
          modelBadge={{ model: 'anthropic' }}
        >
          User message
        </MessageBubble>
      );
      
      const badge = screen.queryByText(/anthropic/i);
      expect(badge).not.toBeInTheDocument();
    });

    it('shows model badge for agent messages', () => {
      render(
        <MessageBubble 
          sender="agent"
          modelBadge={{ model: 'anthropic' }}
        >
          Agent message
        </MessageBubble>
      );
      
      const badge = screen.getByText('Anthropic');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('.modelBadge')).toHaveClass('model-anthropic');
    });

    it('shows custom label when provided', () => {
      render(
        <MessageBubble 
          sender="agent"
          modelBadge={{ model: 'anthropic', label: 'Claude-3' }}
        >
          Agent message
        </MessageBubble>
      );
      
      expect(screen.getByText('Claude-3')).toBeInTheDocument();
    });

    it('renders different model types correctly', () => {
      const models = [
        { model: 'anthropic' as const, expectedText: 'Anthropic' },
        { model: 'openai' as const, expectedText: 'Openai' },
        { model: 'gemini' as const, expectedText: 'Gemini' }
      ];

      models.forEach(({ model, expectedText }) => {
        const { unmount } = render(
          <MessageBubble 
            sender="agent"
            modelBadge={{ model }}
          >
            Agent message
          </MessageBubble>
        );
        
        const badge = screen.getByText(expectedText);
        expect(badge.closest('.modelBadge')).toHaveClass(`model-${model}`);
        
        // Check that icon is present
        const icon = badge.closest('.modelBadge')?.querySelector('svg');
        expect(icon).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Animation Behavior', () => {
    it('applies animation class by default', () => {
      render(<MessageBubble {...defaultProps} />);
      
      const container = screen.getByText('Test message content').closest('.messageContainer');
      expect(container).toHaveClass('animate');
    });

    it('does not apply animation class when animate is false', () => {
      render(<MessageBubble {...defaultProps} animate={false} />);
      
      const container = screen.getByText('Test message content').closest('.messageContainer');
      expect(container).not.toHaveClass('animate');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<MessageBubble {...defaultProps} />);
      
      const message = screen.getByText('Test message content');
      expect(message).toHaveAttribute('role', 'log');
      expect(message).toHaveAttribute('aria-live', 'polite');
    });

    it('provides proper alt text for avatars', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ src: '/avatar.jpg', alt: 'User avatar' }}
        />
      );
      
      const avatar = screen.getByAltText('User avatar');
      expect(avatar).toBeInTheDocument();
    });

    it('provides default alt text when not specified', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ src: '/avatar.jpg' }}
        />
      );
      
      const avatar = screen.getByAltText('Avatar');
      expect(avatar).toBeInTheDocument();
    });

    it('has proper aria-label for initials avatar', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'JD', alt: 'John Doe' }}
        />
      );
      
      const avatar = screen.getByLabelText('John Doe');
      expect(avatar).toBeInTheDocument();
    });

    it('has semantic time element for timestamps', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      render(
        <MessageBubble 
          {...defaultProps} 
          timestamp={testDate}
        />
      );
      
      const timestamp = screen.getByRole('time');
      expect(timestamp.tagName).toBe('TIME');
      expect(timestamp).toHaveAttribute('datetime', testDate.toString());
    });
  });

  describe('Theme Integration', () => {
    it('applies base message bubble classes', () => {
      render(<MessageBubble {...defaultProps} />);
      
      const message = screen.getByText('Test message content');
      expect(message).toHaveClass('messageBubble');
      
      const container = message.closest('.messageContainer');
      expect(container).toHaveClass('messageContainer');
    });

    it('combines multiple classes correctly', () => {
      render(
        <MessageBubble 
          sender="agent"
          className="custom-class"
          containerClassName="custom-container"
          avatar={{ initials: 'AI' }}
          timestamp={new Date()}
          modelBadge={{ model: 'anthropic' }}
        >
          Test message
        </MessageBubble>
      );
      
      const message = screen.getByText('Test message');
      expect(message).toHaveClass('messageBubble');
      expect(message).toHaveClass('bubble-agent');
      expect(message).toHaveClass('custom-class');
      
      const container = message.closest('.messageContainer');
      expect(container).toHaveClass('messageContainer');
      expect(container).toHaveClass('container-agent');
      expect(container).toHaveClass('custom-container');
    });
  });

  describe('Paper Integration', () => {
    it('forwards props to Paper component', () => {
      const handleClick = vi.fn();
      render(
        <MessageBubble 
          {...defaultProps}
          onClick={handleClick}
          data-testid="message-paper"
        />
      );
      
      const message = screen.getByTestId('message-paper');
      expect(message).toBeInTheDocument();
    });

    it('applies Paper elevation correctly', () => {
      const { rerender } = render(
        <MessageBubble sender="user">User message</MessageBubble>
      );
      
      let message = screen.getByText('User message');
      expect(message).toHaveClass('elevation-raised');
      
      rerender(
        <MessageBubble sender="agent">Agent message</MessageBubble>
      );
      message = screen.getByText('Agent message');
      expect(message).toHaveClass('elevation-recessed');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      
      render(<MessageBubble {...defaultProps} ref={ref} />);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass('messageContainer');
    });
  });

  describe('Component Display Name', () => {
    it('has correct display name for debugging', () => {
      expect(MessageBubble.displayName).toBe('MessageBubble');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty children gracefully', () => {
      render(<MessageBubble sender="user" />);
      
      const message = screen.getByRole('log');
      expect(message).toBeInTheDocument();
      expect(message).toBeEmptyDOMElement();
    });

    it('handles very long initials', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'verylongname' }}
        />
      );
      
      // Should only show first 2 characters
      expect(screen.getByText('VE')).toBeInTheDocument();
    });

    it('handles special characters in initials', () => {
      render(
        <MessageBubble 
          {...defaultProps}
          avatar={{ initials: 'j.d.' }}
        />
      );
      
      expect(screen.getByText('J.')).toBeInTheDocument();
    });
  });
});