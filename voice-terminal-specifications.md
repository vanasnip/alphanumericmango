# Voice Terminal Implementation Specifications

## Overview
This document provides detailed technical specifications for implementing the UI/UX improvements outlined in `voice-terminal-ui-improvements.md`. Each specification includes acceptance criteria, technical requirements, and implementation notes.

---

## SPEC-001: Paper Theme System

### Description
Replace the Ocean theme with a neumorphic "Paper" theme featuring soft shadows and subtle depth effects.

### Technical Requirements

#### Color Palette
```css
/* Light Mode - Paper Theme */
:root[data-theme="paper-light"] {
  --bg-primary: #EFF2F9;
  --bg-secondary: #E4EBF1;
  --bg-tertiary: #B5BFC6;
  --text-primary: #6E7F8D;
  --text-secondary: #B5BFC6;
  --shadow-inner: #FAFBFF;
  --shadow-outer: rgba(22, 27, 29, 0.23);
}

/* Dark Mode - Midnight Paper */
:root[data-theme="paper-dark"] {
  --bg-primary: #1A1B1E;
  --bg-secondary: #222326;
  --bg-tertiary: #2A2B2F;
  --text-primary: #E4E6E9;
  --text-secondary: #B8BCC3;
  --text-bright: #F0F2F5;
  --shadow-raised: rgba(47, 49, 53, 0.3);
  --shadow-recessed: rgba(15, 16, 18, 0.5);
}
```

#### Shadow System
```css
/* Neumorphic Shadow Mixins */
.shadow-raised {
  box-shadow: 
    -5px -5px 10px var(--shadow-inner),
    5px 5px 10px var(--shadow-outer);
}

.shadow-recessed {
  box-shadow: 
    inset -5px -5px 10px var(--shadow-inner),
    inset 5px 5px 10px var(--shadow-outer);
}

.shadow-flat {
  box-shadow: 
    -2px -2px 5px var(--shadow-inner),
    2px 2px 5px var(--shadow-outer);
}
```

### Acceptance Criteria
- [ ] All harsh borders removed
- [ ] Background colors create section differentiation
- [ ] Soft shadows create depth without harsh lines
- [ ] 8px grid system for spacing (8, 16, 24, 32px)
- [ ] Both light and dark modes maintain paper aesthetic
- [ ] All text maintains WCAG AA contrast ratios

### Implementation Priority
**HIGH** - Foundation for all other improvements

---

## SPEC-002: Window Controls Padding Fix

### Description
Fix macOS window control buttons overlapping with application title.

### Technical Requirements

#### Platform Detection
```javascript
// Electron main process
const platform = process.platform;
mainWindow.webContents.send('platform-info', platform);

// Renderer process
ipcRenderer.on('platform-info', (event, platform) => {
  document.body.classList.add(`platform-${platform}`);
});
```

#### CSS Platform Adjustments
```css
/* macOS specific padding */
.platform-darwin .app-header {
  padding-left: 80px;
  -webkit-app-region: drag;
}

.platform-darwin .app-header-controls {
  margin-left: 80px;
  -webkit-app-region: no-drag;
}

/* Windows specific padding */
.platform-win32 .app-header {
  padding-right: 140px;
}

/* Linux - standard padding */
.platform-linux .app-header {
  padding: 0 16px;
}
```

### Acceptance Criteria
- [ ] Window controls don't overlap content on any platform
- [ ] Title remains draggable for window movement
- [ ] Controls remain clickable
- [ ] Responsive to window resize

### Implementation Priority
**HIGH** - Critical usability issue

---

## SPEC-003: Banner Removal & Tab Integration

### Description
Remove redundant banner section and connect tabs directly to content area.

### Technical Requirements

#### Layout Structure
```html
<!-- BEFORE -->
<div class="app-container">
  <div class="tab-bar">...</div>
  <div class="banner">  <!-- REMOVE THIS -->
    <div class="split-controls">...</div>
    <div class="title">AI Voice Terminal</div>
    <div class="controls">...</div>
  </div>
  <div class="content">...</div>
</div>

<!-- AFTER -->
<div class="app-container">
  <div class="tab-bar">...</div>
  <div class="content">...</div>
</div>
```

#### Tab Styling
```css
.tab-bar {
  background: var(--bg-secondary);
  padding: 0;
  height: 40px;
}

.tab {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px 8px 0 0;
  background: var(--bg-secondary);
  border: none;
}

.tab.active {
  background: var(--bg-primary);
  border-bottom: 3px solid var(--project-color);
  box-shadow: var(--shadow-flat);
}

.content {
  background: var(--bg-primary);
  margin-top: 0; /* Direct connection */
}
```

#### Control Relocation
- Split orientation controls → Settings panel
- Microphone toggle → Status bar or toolbar
- Help icon → Menu bar
- Theme indicator → Status bar

### Acceptance Criteria
- [ ] Banner completely removed
- [ ] Tabs connect directly to content (no gap)
- [ ] Active tab visually connected to content area
- [ ] All controls relocated to appropriate locations
- [ ] No loss of functionality

### Implementation Priority
**HIGH** - Major UX improvement

---

## SPEC-004: Chat Bubble Interface

### Description
Implement differentiated chat bubbles with model identification.

### Technical Requirements

#### Message Components
```typescript
interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: Date;
  model?: 'claude' | 'gpt' | 'gemini';
  avatar?: string;
}
```

#### Bubble Styling
```css
.message {
  margin: 16px 0;
  display: flex;
  align-items: flex-start;
}

.message-user {
  flex-direction: row-reverse;
}

.message-bubble {
  max-width: 70%;
  padding: 12px 16px;
  box-shadow: var(--shadow-flat);
}

.message-user .message-bubble {
  background: var(--bg-tertiary);
  border-radius: 20px 20px 8px 20px;
  box-shadow: var(--shadow-raised);
}

.message-agent .message-bubble {
  background: var(--bg-secondary);
  border-radius: 8px 12px 12px 8px;
}

.message-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.message-avatar {
  width: 32px;
  height: 32px;
  margin: 0 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Acceptance Criteria
- [ ] User messages: Rounded pill shape, right-aligned
- [ ] Agent messages: Soft rectangle, left-aligned
- [ ] Model provider logos displayed for agents
- [ ] Labels above bubbles showing sender name
- [ ] Timestamps displayed inline with labels
- [ ] Smooth animations for new messages

### Implementation Priority
**MEDIUM** - Core feature enhancement

---

## SPEC-005: Project Color System

### Description
Implement automatic color assignment for projects with subtle UI indicators.

### Technical Requirements

#### Color Assignment
```typescript
const PROJECT_COLORS = [
  '#F4B942', // Yellow/Gold
  '#5B8DEE', // Blue
  '#48C78E', // Green
  '#3ABFF8', // Cyan
  '#9333EA', // Purple
  '#92754C', // Brown
  '#EE5A52', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
];

class ProjectManager {
  assignColor(projectId: string): string {
    const index = this.projects.length % PROJECT_COLORS.length;
    return PROJECT_COLORS[index];
  }
}
```

#### UI Integration
```css
.app-container {
  --project-color: #5B8DEE; /* Dynamic per project */
}

.project-indicator {
  height: 2px;
  background: var(--project-color);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.typing-dots span {
  background: var(--project-color);
  opacity: 0.7;
}

.project-card {
  border-bottom: 4px solid var(--project-color);
}
```

### Acceptance Criteria
- [ ] Each project gets unique color from palette
- [ ] Thin accent line at top when project active
- [ ] Typing indicators use project color
- [ ] Project grid shows color coding
- [ ] Colors work in both light and dark themes

### Implementation Priority
**MEDIUM** - Enhanced project management

---

## SPEC-006: Hexagonal Voice Indicator

### Description
Implement shadow-based hexagonal voice visualization responding to audio input.

### Technical Requirements

#### Hexagon Grid Structure
```typescript
interface HexagonGrid {
  rings: number; // 0-3 based on amplitude
  hexagons: Hexagon[];
  audioAnalyzer: AnalyserNode;
}

class Hexagon {
  position: {x: number, y: number};
  depth: number; // -1 to 1 for shadow depth
  neighbors: Hexagon[];
}
```

#### CSS Implementation
```css
.hexagon {
  width: 40px;
  height: 40px;
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
  transition: box-shadow 0.2s ease;
}

.hexagon-rest {
  box-shadow: var(--shadow-flat);
  opacity: 0.3;
}

.hexagon-active {
  box-shadow: var(--shadow-raised);
  opacity: 1;
}

.hexagon-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  transition: all 0.3s ease;
}
```

#### Audio Processing
```javascript
class VoiceVisualizer {
  constructor(audioContext) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  updateHexagons() {
    this.analyser.getByteFrequencyData(this.dataArray);
    const amplitude = this.getAverageAmplitude();
    const rings = Math.floor(amplitude / 50); // 0-3 rings
    this.grid.expandToRings(rings);
  }

  getAverageAmplitude() {
    return this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;
  }
}
```

### Acceptance Criteria
- [ ] Single hexagon at rest
- [ ] Expands to rings based on voice amplitude
- [ ] Individual hexagons respond to frequency
- [ ] Smooth animations between states
- [ ] Pure shadow effects (no color required)
- [ ] Optional photon pulse effect (experimental)

### Implementation Priority
**LOW** - Innovative but not critical

---

## SPEC-007: Voice/Text Flexibility

### Description
Support flexible voice and text input/output modes.

### Technical Requirements

#### Mode Configuration
```typescript
enum InputMode {
  VOICE = 'voice',
  TEXT = 'text',
  BOTH = 'both'
}

enum OutputMode {
  VOICE = 'voice',
  TEXT = 'text',
  BOTH = 'both'
}

interface InteractionSettings {
  inputMode: InputMode;
  outputMode: OutputMode;
  autoDetect: boolean;
}
```

#### UI Controls
```html
<div class="input-controls">
  <button class="mic-toggle" [class.active]="voiceEnabled">
    <icon name="microphone" />
  </button>
  <input type="text" class="text-input" placeholder="Type or speak..." />
  <button class="send-button">
    <icon name="send" />
  </button>
</div>
```

### Acceptance Criteria
- [ ] Voice input always available
- [ ] Text input always visible
- [ ] Mode toggle in settings
- [ ] Visual feedback for active mode
- [ ] Seamless switching between modes
- [ ] Respect user preferences

### Implementation Priority
**HIGH** - Core functionality

---

## SPEC-008: Typography System

### Description
Implement consistent typography hierarchy with paper aesthetic.

### Technical Requirements

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
  
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 17px;
  --text-xl: 20px;
  
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  
  --line-height-tight: 1.2;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.75;
}

.text-primary {
  font-family: var(--font-primary);
  font-weight: var(--weight-regular);
  line-height: var(--line-height-base);
}

.text-mono {
  font-family: var(--font-mono);
  font-weight: var(--weight-regular);
}
```

### Acceptance Criteria
- [ ] Consistent font families across UI
- [ ] Clear hierarchy for headings/body/captions
- [ ] Monospace for code/terminal output
- [ ] Readable at all sizes
- [ ] Appropriate line heights

### Implementation Priority
**MEDIUM** - Polish and consistency

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. SPEC-001: Paper Theme System
2. SPEC-002: Window Controls Fix
3. SPEC-007: Voice/Text Flexibility

### Phase 2: Core Improvements (Week 2)
4. SPEC-003: Banner Removal
5. SPEC-004: Chat Bubble Interface
6. SPEC-008: Typography System

### Phase 3: Enhancements (Week 3)
7. SPEC-005: Project Color System
8. SPEC-006: Hexagonal Voice Indicator

### Testing & Refinement (Week 4)
- User testing
- Performance optimization
- Accessibility audit
- Bug fixes

---

## Success Metrics

1. **Visual Consistency**: 100% adherence to paper aesthetic
2. **Performance**: < 16ms frame time for animations
3. **Accessibility**: WCAG AA compliance
4. **User Satisfaction**: Positive feedback on new design
5. **Code Quality**: Clean, maintainable implementation

---

*Last Updated: 2025-01-15*
*Status: Ready for Implementation*