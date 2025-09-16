# MessageBubble Component - Corrected Specifications v2

## Component Architecture

### Core Visual Design

#### 1. Shape System (CRITICAL)

```css
/* User Message - Perfect Pill Shape */
.message-bubble--user {
  border-radius: 999px; /* Creates pill/capsule shape */
  padding: 12px 20px;
  min-height: 44px;
  max-width: 70%;
}

/* Agent Message - Rounded Rectangle */
.message-bubble--agent {
  border-radius: 12px; /* Subtle rounded corners */
  padding: 12px 16px;
  min-height: 44px;
  max-width: 70%;
}
```

#### 2. Neumorphic Shadow System

```css
/* Neumorphic elevation for both bubble types */
.message-bubble {
  /* Primary shadows for depth */
  box-shadow: 
    /* Bottom-right shadow (main depth) */
    6px 6px 12px rgba(0, 0, 0, 0.08),
    4px 4px 8px rgba(0, 0, 0, 0.04),
    /* Top-left highlight (lifted edge) */
    -2px -2px 4px rgba(255, 255, 255, 0.9),
    /* Inset for paper texture */
    inset 1px 1px 1px rgba(255, 255, 255, 0.3);
  
  /* Smooth transitions */
  transition: box-shadow 0.3s ease;
}

/* Hover state - subtle lift */
.message-bubble:hover {
  box-shadow: 
    8px 8px 16px rgba(0, 0, 0, 0.1),
    6px 6px 12px rgba(0, 0, 0, 0.05),
    -3px -3px 6px rgba(255, 255, 255, 0.95),
    inset 1px 1px 1px rgba(255, 255, 255, 0.4);
}
```

#### 3. Avatar System

```typescript
interface AvatarProps {
  type: 'user' | 'agent';
  image?: string; // For user photos
  initials?: string; // Fallback for users
}
```

**User Avatar**:
- Shape: Perfect circle (40x40px)
- Position: Outside bubble, vertically centered
- Content: User photo or initials
- Border: 2px solid with neumorphic effect

**Agent Avatar**:
- Shape: Rounded square (40x40px, border-radius: 8px)
- Position: Outside bubble, vertically centered
- Content: "AI" text badge
- Background: Orange/amber (#FF6B35 or #FFA500)
- Text: White, bold, sans-serif

```css
/* User Avatar */
.avatar--user {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.1),
    -1px -1px 2px rgba(255, 255, 255, 0.9);
}

/* Agent Avatar */
.avatar--agent {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #FF6B35, #FFA500);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: white;
  box-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.15),
    -1px -1px 2px rgba(255, 255, 255, 0.9);
}
```

#### 4. Timestamp Integration (Inside Bubble)

```typescript
interface TimestampProps {
  time: Date;
  position: 'bottom-right' | 'bottom-left';
}
```

**Placement Rules**:
- User messages: Bottom-left corner (inside bubble)
- Agent messages: Bottom-right corner (inside bubble)
- Size: 11px
- Color: 60% opacity of text color
- Spacing: 4px from edges

```css
/* Timestamp styling */
.message-timestamp {
  position: absolute;
  font-size: 11px;
  color: rgba(107, 114, 128, 0.6); /* gray-500 at 60% */
  font-weight: 400;
  user-select: none;
}

/* User message timestamp (bottom-left) */
.message-bubble--user .message-timestamp {
  bottom: 8px;
  left: 20px; /* Account for pill padding */
}

/* Agent message timestamp (bottom-right) */
.message-bubble--agent .message-timestamp {
  bottom: 8px;
  right: 16px;
}

/* Message content needs padding to avoid overlap */
.message-content {
  padding-bottom: 20px; /* Space for timestamp */
}
```

#### 5. Layout Structure

```jsx
// User Message Layout
<div className="message-container message-container--user">
  <div className="message-bubble message-bubble--user">
    <div className="message-content">
      {content}
    </div>
    <span className="message-timestamp">2:30 PM</span>
  </div>
  <div className="avatar avatar--user">
    <img src={userImage} alt={userName} />
  </div>
</div>

// Agent Message Layout
<div className="message-container message-container--agent">
  <div className="avatar avatar--agent">
    AI
  </div>
  <div className="message-bubble message-bubble--agent">
    <div className="message-content">
      {content}
    </div>
    <span className="message-timestamp">2:31 PM</span>
  </div>
</div>
```

#### 6. Container Styling

```css
/* Message container */
.message-container {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 16px;
  align-items: flex-start;
}

/* User container - right aligned */
.message-container--user {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

/* Agent container - left aligned */
.message-container--agent {
  flex-direction: row;
  justify-content: flex-start;
}
```

## Color Palette

### Light Theme (Paper)
```css
:root {
  --background: #EFF2F9;
  --bubble-user: #FFFFFF;
  --bubble-agent: #FAFBFC;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --avatar-ai-bg: #FF6B35;
  --shadow-dark: rgba(0, 0, 0, 0.08);
  --shadow-light: rgba(255, 255, 255, 0.9);
}
```

### Dark Theme (Midnight Paper)
```css
:root[data-theme="dark"] {
  --background: #1A1F2E;
  --bubble-user: #2D3444;
  --bubble-agent: #252A37;
  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --avatar-ai-bg: #FF8F5C;
  --shadow-dark: rgba(0, 0, 0, 0.3);
  --shadow-light: rgba(255, 255, 255, 0.05);
}
```

## Component Props Interface

```typescript
interface MessageBubbleProps {
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  avatar?: {
    image?: string;
    initials?: string;
    alt?: string;
  };
  isTyping?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}
```

## Animation Specifications

### Entry Animation
```css
@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-container {
  animation: slideInFromBottom 0.3s ease-out;
}
```

### Typing Indicator
```css
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 0;
}

.typing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: typing 1.4s infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { opacity: 0.4; }
  30% { opacity: 1; }
}
```

## Accessibility Requirements

- Proper ARIA labels for screen readers
- Keyboard navigation support
- Sufficient color contrast (WCAG AA)
- Focus indicators for interactive elements
- Semantic HTML structure (article, time elements)

## Implementation Priorities

1. **Fix shape distinction** - Pill vs rectangle
2. **Enhance neumorphic shadows** - Stronger depth effect
3. **Implement proper avatars** - Circle photos vs AI badge
4. **Move timestamps inside** - Bottom corner placement
5. **Simplify metadata** - Remove clutter
6. **Add animations** - Smooth entry and interactions

## Testing Requirements

- Visual regression tests for both themes
- Shape rendering on different screen sizes
- Shadow rendering across browsers
- Avatar image loading and fallbacks
- Timestamp formatting and localization
- Animation performance on low-end devices

---

*This specification corrects all issues identified in the comparison document and aligns with the original design vision.*