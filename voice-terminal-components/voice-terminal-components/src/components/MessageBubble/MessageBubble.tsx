import React, { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './MessageBubble.module.css';

// Avatar configuration types
export interface AvatarConfig {
  /**
   * Avatar image URL for user messages
   */
  image?: string;
  /**
   * Alt text for avatar image
   */
  alt?: string;
  /**
   * Initials to display if no image is provided for user messages
   */
  initials?: string;
}

// Message type determines styling and layout
export type MessageType = 'user' | 'agent';

// MessageBubble component props
export interface MessageBubbleProps {
  /**
   * Message type (determines shape, alignment, and styling)
   */
  type: MessageType;
  
  /**
   * The message content
   */
  content: string;
  
  /**
   * Timestamp to display inside the bubble
   */
  timestamp: Date;
  
  /**
   * Avatar configuration (optional for user messages)
   */
  avatar?: AvatarConfig;
  
  /**
   * Whether the message is currently being typed (for agent messages)
   * @default false
   */
  isTyping?: boolean;
  
  /**
   * Message status for user messages
   */
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  
  /**
   * Custom CSS class for the message container
   */
  className?: string;
}

/**
 * User Avatar component - Perfect circle with photo or initials
 */
const UserAvatar: React.FC<AvatarConfig> = ({ image, alt, initials }) => {
  if (image) {
    return (
      <img
        src={image}
        alt={alt || 'User avatar'}
        className={styles.avatarUser}
        loading="lazy"
      />
    );
  }

  if (initials) {
    return (
      <div className={styles.avatarUser} aria-label={alt || 'User avatar'}>
        <span className={styles.avatarInitials}>
          {initials.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  // Default user avatar icon
  return (
    <div className={styles.avatarUser} aria-label={alt || 'User avatar'}>
      <svg
        className={styles.avatarIcon}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
};

/**
 * Agent Avatar component - Rounded square with "AI" badge
 */
const AgentAvatar: React.FC = () => {
  return (
    <div className={styles.avatarAgent} aria-label="AI Assistant">
      <span className={styles.avatarAIText}>AI</span>
    </div>
  );
};

/**
 * Typing indicator for agent messages
 */
const TypingIndicator: React.FC = () => {
  return (
    <div className={styles.typingIndicator} aria-label="AI is typing">
      <div className={styles.typingDot} />
      <div className={styles.typingDot} />
      <div className={styles.typingDot} />
    </div>
  );
};

/**
 * Timestamp component - positioned inside bubble
 */
const Timestamp: React.FC<{ timestamp: Date; type: MessageType }> = ({ 
  timestamp, 
  type 
}) => {
  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const timestampClasses = clsx(
    styles.messageTimestamp,
    type === 'user' ? styles.timestampUser : styles.timestampAgent
  );

  return (
    <time className={timestampClasses} dateTime={timestamp.toISOString()}>
      {formatTimestamp(timestamp)}
    </time>
  );
};

/**
 * MessageBubble - A component for displaying chat messages with critical shape distinction
 * 
 * Features:
 * - User messages: TRUE PILL SHAPE (border-radius: 999px)
 * - Agent messages: Rounded rectangle (border-radius: 12px)
 * - Strong neumorphic shadows for depth
 * - Timestamps inside bubbles (user=bottom-left, agent=bottom-right)
 * - User avatars: 40px circle with photo/initials
 * - Agent avatars: 40px rounded square with "AI" badge
 * - Clean, simplified design
 * 
 * @example
 * ```tsx
 * // User message
 * <MessageBubble 
 *   type="user"
 *   content="Hello, how are you?"
 *   timestamp={new Date()}
 *   avatar={{ initials: "JD" }}
 * />
 * 
 * // Agent message
 * <MessageBubble 
 *   type="agent"
 *   content="I'm doing well, thank you!"
 *   timestamp={new Date()}
 * />
 * ```
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  (
    {
      type,
      content,
      timestamp,
      avatar,
      isTyping = false,
      status,
      className,
    },
    ref
  ) => {
    const containerClasses = clsx(
      styles.messageContainer,
      styles[`messageContainer--${type}`],
      className
    );

    const bubbleClasses = clsx(
      styles.messageBubble,
      styles[`messageBubble--${type}`]
    );

    return (
      <div className={containerClasses} ref={ref}>
        {/* Agent avatar on left */}
        {type === 'agent' && (
          <AgentAvatar />
        )}
        
        {/* Message bubble */}
        <div 
          className={bubbleClasses}
          role="article"
          aria-live="polite"
        >
          <div className={styles.messageContent}>
            {isTyping ? <TypingIndicator /> : content}
          </div>
          <Timestamp timestamp={timestamp} type={type} />
        </div>
        
        {/* User avatar on right */}
        {type === 'user' && avatar && (
          <UserAvatar {...avatar} />
        )}
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;