# Voice Terminal Context Switching Plan

## Current State Analysis

### Existing Click-to-Speak Implementation
- **Trigger**: Button click activates voice recording (line 382 in FlexibleTerminal.svelte)
- **Recognition**: Uses Web Speech API with `continuous: false` (single utterance mode)
- **State Management**: `isRecording` boolean tracks recording state
- **Visual Feedback**: Button changes appearance when recording/speaking
- **Stop Method**: Recognition stops automatically after silence or manual stop

## Context Switching Requirements

### 1. Core Context Types
```typescript
type Context = 
  | 'terminal'      // Traditional command execution
  | 'conversation'  // AI conversation mode
  | 'project'       // Project-specific operations
  | 'system'        // System-level commands
  | 'custom'        // User-defined contexts
```

### 2. Context Switching Mechanisms

#### A. Voice-Triggered Context Switch
- **Keywords**: "switch to [context]", "context [name]", "mode [type]"
- **Quick Commands**: Shortened aliases (e.g., "terminal", "chat", "project")
- **Confirmation**: Audio/visual feedback on context change

#### B. UI-Based Context Switch
- **Context Selector**: Dropdown or tab interface
- **Keyboard Shortcuts**: Ctrl+1-5 for quick context switching
- **Visual Indicators**: Color-coded borders/backgrounds per context

#### C. Automatic Context Detection
- **Pattern Recognition**: Analyze input to suggest context
- **Smart Routing**: Auto-switch based on command patterns
- **Learning**: Track user preferences for context switching

### 3. Implementation Strategy

#### Phase 1: Basic Context Infrastructure
```typescript
interface ContextManager {
  currentContext: Context;
  contextHistory: Context[];
  contextHandlers: Map<Context, ContextHandler>;
  
  switchContext(newContext: Context): void;
  processInput(input: string): ProcessedResult;
  suggestContext(input: string): Context | null;
}
```

#### Phase 2: Enhanced Voice Control
```typescript
interface VoiceContextControl {
  // Modify existing voice recognition
  recognition: {
    continuous: boolean;  // Can be toggled
    contextAware: boolean;
    activeContext: Context;
  };
  
  // Context-specific grammars
  contextGrammars: Map<Context, Grammar>;
  
  // Wake word detection (future)
  wakeWordEnabled: boolean;
  wakeWord: string;  // e.g., "terminal", "assistant"
}
```

#### Phase 3: UI Adjustments
```svelte
<!-- Context Switcher Component -->
<div class="context-switcher">
  <button 
    class="context-btn" 
    class:active={currentContext === 'terminal'}
    on:click={() => switchContext('terminal')}
  >
    Terminal
  </button>
  <button 
    class="context-btn"
    class:active={currentContext === 'conversation'}
    on:click={() => switchContext('conversation')}
  >
    AI Chat
  </button>
  <button 
    class="context-btn"
    class:active={currentContext === 'project'}
    on:click={() => switchContext('project')}
  >
    Project
  </button>
</div>
```

### 4. Future: Continuous Listening Mode

#### Architecture
```typescript
interface ContinuousListeningMode {
  enabled: boolean;
  wakeWordDetection: boolean;
  ambientListening: boolean;
  privacyMode: 'strict' | 'balanced' | 'permissive';
  
  // Voice Activity Detection (VAD)
  vadThreshold: number;
  silenceTimeout: number;
  
  // Context-aware processing
  contextualActivation: {
    terminal: string[];     // ["execute", "run", "command"]
    conversation: string[]; // ["hey", "assistant", "help"]
    project: string[];      // ["project", "switch", "open"]
  };
}
```

#### Privacy & Performance Considerations
- **Local Processing**: Wake word detection runs locally
- **Streaming Mode**: Process audio in chunks
- **Power Management**: Reduce processing when idle
- **Visual Indicators**: Always show when listening
- **Mute Button**: Hardware-style mute control

### 5. Implementation Roadmap

#### Week 1: Foundation
- [ ] Create ContextManager class
- [ ] Implement basic context switching logic
- [ ] Add context state to stores
- [ ] Update UI with context indicators

#### Week 2: Voice Integration
- [ ] Modify VoiceRecognition for context awareness
- [ ] Add voice command parsing for context switches
- [ ] Implement context-specific command processing
- [ ] Add audio feedback for context changes

#### Week 3: UI Enhancement
- [ ] Build context switcher component
- [ ] Add keyboard shortcuts
- [ ] Implement visual context indicators
- [ ] Create context-specific UI layouts

#### Week 4: Advanced Features
- [ ] Add automatic context detection
- [ ] Implement context history/navigation
- [ ] Create context-specific settings
- [ ] Add user preferences storage

#### Future Phases
- [ ] Continuous listening mode preparation
- [ ] Wake word detection research
- [ ] Voice Activity Detection (VAD)
- [ ] Privacy controls implementation
- [ ] Performance optimization

## Technical Considerations

### State Management
```typescript
// stores/contextStore.ts
import { writable, derived } from 'svelte/store';

export const currentContext = writable<Context>('conversation');
export const contextHistory = writable<Context[]>([]);
export const contextSettings = writable<Map<Context, ContextConfig>>(new Map());

export const contextColor = derived(
  currentContext,
  $context => {
    const colors = {
      terminal: '#00ff00',
      conversation: '#00aaff',
      project: '#ff6600',
      system: '#ff00ff',
      custom: '#ffff00'
    };
    return colors[$context] || '#ffffff';
  }
);
```

### Voice Recognition Modifications
```typescript
// Extend existing VoiceRecognition class
class ContextAwareVoiceRecognition extends VoiceRecognition {
  private contextGrammars: Map<Context, string[]>;
  private continuousMode: boolean = false;
  
  enableContinuousMode() {
    this.recognition.continuous = true;
    this.continuousMode = true;
  }
  
  disableContinuousMode() {
    this.recognition.continuous = false;
    this.continuousMode = false;
  }
  
  setContextGrammar(context: Context, keywords: string[]) {
    this.contextGrammars.set(context, keywords);
  }
}
```

### Performance Optimization
- Lazy load context-specific modules
- Cache frequently used contexts
- Implement debouncing for rapid context switches
- Use Web Workers for heavy processing

## Migration Path

### Current Users
1. Keep click-to-speak as default
2. Introduce context switching as opt-in feature
3. Gradually expose advanced features
4. Maintain backward compatibility

### Configuration
```json
{
  "voice": {
    "mode": "click-to-speak",  // or "continuous"
    "contextSwitching": true,
    "autoContextDetection": false,
    "wakeWord": "assistant",
    "defaultContext": "conversation"
  },
  "contexts": {
    "terminal": { "color": "#00ff00", "shortcuts": ["ctrl+1"] },
    "conversation": { "color": "#00aaff", "shortcuts": ["ctrl+2"] },
    "project": { "color": "#ff6600", "shortcuts": ["ctrl+3"] }
  }
}
```

## Success Metrics
- Context switch latency < 100ms
- Voice command recognition accuracy > 95%
- User engagement with multiple contexts > 60%
- Reduced command errors due to wrong context
- Positive user feedback on context clarity

## Future Considerations

### Previous Context Navigation
A "previous" context feature could enable quick toggling between contexts:
- **Quick Toggle**: Jump between two most recent contexts (like Alt+Tab)
- **Context History Stack**: Navigate through context history with back/forward
- **Voice Commands**: "previous", "go back", "last context"
- **Keyboard Shortcuts**: Ctrl+Tab for quick toggle, Ctrl+[/] for history navigation

This feature would be particularly useful for rapid switching between terminal and conversation modes but is not planned for initial implementation.

## Next Steps
1. Review and approve plan
2. Set up development branch
3. Begin Phase 1 implementation
4. Create test scenarios
5. Gather user feedback early and often