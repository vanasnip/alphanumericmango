import React, { forwardRef } from 'react';
import clsx from 'clsx';
import Paper from '../Paper';
import type { PaperProps } from '../Paper/Paper';
import styles from './MessageBubble.module.css';

// Avatar configuration types
export interface AvatarConfig {
  /**
   * Avatar image URL
   */
  src?: string;
  /**
   * Alt text for avatar image
   */
  alt?: string;
  /**
   * Initials to display if no image is provided
   */
  initials?: string;
  /**
   * Size of the avatar
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
}

// Model badge configuration
export interface ModelBadge {
  /**
   * The AI model name (anthropic, openai, gemini)
   */
  model: 'anthropic' | 'openai' | 'gemini';
  /**
   * Optional custom label
   */
  label?: string;
}

// Message sender types
export type MessageSender = 'user' | 'agent';

// MessageBubble component props
export interface MessageBubbleProps extends Omit<PaperProps, 'elevation' | 'padding'> {
  /**
   * Who sent the message (determines alignment and styling)
   */
  sender: MessageSender;
  
  /**
   * The message content
   */
  children: React.ReactNode;
  
  /**
   * Avatar configuration
   */
  avatar?: AvatarConfig;
  
  /**
   * Timestamp to display above the bubble
   */
  timestamp?: string | Date;
  
  /**
   * Model badge for AI messages
   */
  modelBadge?: ModelBadge;
  
  /**
   * Whether to show the timestamp
   * @default true
   */
  showTimestamp?: boolean;
  
  /**
   * Whether to animate the bubble entrance
   * @default true
   */
  animate?: boolean;
  
  /**
   * Custom CSS class for the message container
   */
  containerClassName?: string;
}

/**
 * Avatar component for message bubbles
 */
const Avatar: React.FC<AvatarConfig> = ({ src, alt, initials, size = 'md' }) => {
  const avatarClasses = clsx(
    styles.avatar,
    styles[`avatar-${size}`]
  );

  if (src) {
    return (
      <img
        src={src}
        alt={alt || 'Avatar'}
        className={avatarClasses}
        loading="lazy"
      />
    );
  }

  if (initials) {
    return (
      <div className={avatarClasses} aria-label={alt || 'User avatar'}>
        <span className={styles.avatarInitials}>
          {initials.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  // Default avatar icon
  return (
    <div className={avatarClasses} aria-label={alt || 'Default avatar'}>
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
 * Model badge component for AI messages
 */
const ModelBadgeComponent: React.FC<ModelBadge> = ({ model, label }) => {
  const badgeClasses = clsx(
    styles.modelBadge,
    styles[`model-${model}`]
  );

  const getModelIcon = () => {
    switch (model) {
      case 'anthropic':
        return (
          <svg viewBox="0 0 24 24" className={styles.modelIcon} aria-hidden="true">
            <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM12 4.84L19.65 8.5 12 12.16 4.35 8.5 12 4.84zM4 10.5l7 3.5v6.16l-7-3.5V10.5zm16 0v6.16l-7 3.5V14l7-3.5z" fill="currentColor"/>
          </svg>
        );
      case 'openai':
        return (
          <svg viewBox="0 0 24 24" className={styles.modelIcon} aria-hidden="true">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.078 6.078 0 0 0 6.519 2.9A5.973 5.973 0 0 0 12 21.881a6.002 6.002 0 0 0 7.273-1.097 5.987 5.987 0 0 0 3.009-2.9 6.043 6.043 0 0 0-.743-7.096A5.985 5.985 0 0 0 22.282 9.821z" fill="currentColor"/>
          </svg>
        );
      case 'gemini':
        return (
          <svg viewBox="0 0 24 24" className={styles.modelIcon} aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9l-5.91 1.74L22 15l-6.91.74L12 22l-3.09-6.26L2 15l5.91-1.26L2 9l6.91-.74L12 2z" fill="currentColor"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={badgeClasses}>
      {getModelIcon()}
      <span className={styles.modelLabel}>
        {label || model.charAt(0).toUpperCase() + model.slice(1)}
      </span>
    </div>
  );
};

/**
 * Timestamp component
 */
const Timestamp: React.FC<{ timestamp: string | Date; sender: MessageSender }> = ({ 
  timestamp, 
  sender 
}) => {
  const formatTimestamp = (ts: string | Date): string => {
    const date = typeof ts === 'string' ? new Date(ts) : ts;
    
    if (isNaN(date.getTime())) {
      return typeof ts === 'string' ? ts : '';
    }
    
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const timestampClasses = clsx(
    styles.timestamp,
    styles[`timestamp-${sender}`]
  );

  return (
    <time className={timestampClasses} dateTime={timestamp.toString()}>
      {formatTimestamp(timestamp)}
    </time>
  );
};

/**
 * MessageBubble - A component for displaying chat messages with avatars, timestamps, and model badges
 * 
 * Features:
 * - User vs agent message styling (pill vs rounded rectangle)
 * - Avatar support (images or initials)
 * - Timestamp display
 * - Model badges for AI messages
 * - Theme-aware styling
 * - Smooth animations
 * - Full accessibility support
 * 
 * @example
 * ```tsx
 * // User message
 * <MessageBubble 
 *   sender="user"
 *   avatar={{ initials: "JD" }}
 *   timestamp={new Date()}
 * >
 *   Hello, how are you?
 * </MessageBubble>
 * 
 * // Agent message with model badge
 * <MessageBubble 
 *   sender="agent"
 *   avatar={{ src: "/ai-avatar.png", alt: "AI Assistant" }}
 *   timestamp={new Date()}
 *   modelBadge={{ model: "anthropic", label: "Claude" }}
 * >
 *   I'm doing well, thank you for asking!
 * </MessageBubble>
 * ```
 */
export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  (
    {
      sender,
      children,
      avatar,
      timestamp,
      modelBadge,
      showTimestamp = true,
      animate = true,
      containerClassName,
      className,
      ...restProps
    },
    ref
  ) => {
    const containerClasses = clsx(
      styles.messageContainer,
      styles[`container-${sender}`],
      {
        [styles.animate]: animate,
      },
      containerClassName
    );

    const bubbleClasses = clsx(
      styles.messageBubble,
      styles[`bubble-${sender}`],
      className
    );

    // Determine Paper elevation based on sender
    const elevation = sender === 'user' ? 'raised' : 'recessed';

    return (
      <div className={containerClasses} ref={ref}>
        {/* Timestamp */}
        {showTimestamp && timestamp && (
          <Timestamp timestamp={timestamp} sender={sender} />
        )}
        
        {/* Model badge for agent messages */}
        {sender === 'agent' && modelBadge && (
          <ModelBadgeComponent {...modelBadge} />
        )}
        
        {/* Message row with avatar and bubble */}
        <div className={styles.messageRow}>
          {/* Avatar (left side for agent, right side for user) */}
          {avatar && sender === 'agent' && (
            <div className={styles.avatarContainer}>
              <Avatar {...avatar} />
            </div>
          )}
          
          {/* Message bubble */}
          <Paper
            className={bubbleClasses}
            elevation={elevation}
            padding="md"
            role="log"
            aria-live="polite"
            {...restProps}
          >
            {children}
          </Paper>
          
          {/* Avatar (right side for user) */}
          {avatar && sender === 'user' && (
            <div className={styles.avatarContainer}>
              <Avatar {...avatar} />
            </div>
          )}
        </div>
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;