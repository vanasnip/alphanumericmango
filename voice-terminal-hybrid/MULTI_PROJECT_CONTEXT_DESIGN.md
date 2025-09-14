# Multi-Project Context Architecture

## Vision
Each project runs as an isolated tab with its own terminal and chat contexts, allowing seamless switching between multiple active projects.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Project Tabs Bar                   │
├─────────┬─────────┬─────────┬──────────────────────┤
│ Project A │ Project B │ Project C │    [+] New      │
└─────────┴─────────┴─────────┴──────────────────────┘
           │ (Active)
           ▼
┌─────────────────────────────────────────────────────┐
│  Project B Workspace                                │
│  ┌────────────────┬────────────────┐               │
│  │   Terminal      │   AI Chat      │ <- Contexts  │
│  │                 │                │               │
│  │  $ npm run dev  │  How do I...   │               │
│  │  Server running │  To do that... │               │
│  └────────────────┴────────────────┘               │
└─────────────────────────────────────────────────────┘
```

## Core Data Structure

```typescript
interface ProjectManager {
  projects: Map<string, Project>;
  activeProjectId: string;
  projectOrder: string[];
}

interface Project {
  id: string;
  name: string;
  path: string;  // File system path
  contexts: ProjectContexts;
  metadata: ProjectMetadata;
  state: ProjectState;
}

interface ProjectContexts {
  terminal: TerminalContext;
  chat: ChatContext;
  activeContext: 'terminal' | 'chat';
  contextHistory: string[];
}

interface TerminalContext {
  lines: TerminalLine[];
  currentDirectory: string;
  commandHistory: string[];
  environment: Record<string, string>;
  processId?: number;  // For persistent shell sessions
}

interface ChatContext {
  conversation: ConversationMessage[];
  aiModel: string;
  systemPrompt?: string;
  memoryWindow: number;
}

interface ProjectMetadata {
  createdAt: Date;
  lastAccessed: Date;
  color: string;  // Visual identifier
  icon?: string;
  tags: string[];
}

interface ProjectState {
  isActive: boolean;
  isRunning: boolean;  // Has active processes
  hasUnsavedChanges: boolean;
  lastCommand?: string;
  lastError?: string;
}
```

## Voice Commands for Project Management

### Listening Control (Global)
- **"stop listening"** / **"stop"** - Enters passive mode (still listening but not processing)
- **"start listening"** / **"start"** - Resumes active command processing
- **"mute"** - Alternative to stop listening
- **"unmute"** - Alternative to start listening
- **"are you listening?"** - Check current listening status

### Project Navigation
- **"list projects"** - Shows all open projects
- **"switch to project [name]"** - Activates specific project
- **"project A/B/C"** - Quick switch by letter/number
- **"next/previous project"** - Cycle through projects
- **"close project [name]"** - Close specific project

### Context Commands Within Project
- **"terminal"** - Switch to terminal context in current project
- **"chat"** - Switch to chat context in current project
- **"show both"** - Split view of terminal and chat

### Project Actions
- **"new project [name]"** - Create new project tab
- **"rename project to [name]"** - Rename current project
- **"project status"** - Show current project info
- **"run in all projects"** - Execute command across all projects

## UI Components

### Project Tab Bar
```svelte
<div class="project-tabs">
  {#each projects as project}
    <button 
      class="project-tab"
      class:active={activeProjectId === project.id}
      class:running={project.state.isRunning}
      on:click={() => switchProject(project.id)}
    >
      <span class="project-indicator" style="background-color: {project.metadata.color}"></span>
      <span class="project-name">{project.name}</span>
      {#if project.state.isRunning}
        <span class="running-indicator">●</span>
      {/if}
      <button class="close-btn" on:click|stopPropagation={() => closeProject(project.id)}>×</button>
    </button>
  {/each}
  <button class="new-project-btn" on:click={createNewProject}>
    + New Project
  </button>
</div>
```

### Project Switcher Modal
```svelte
<!-- Quick switcher with fuzzy search -->
<div class="project-switcher-modal" class:visible={showProjectSwitcher}>
  <input 
    type="text" 
    placeholder="Type project name or number..."
    bind:value={projectSearchQuery}
    on:keydown={handleProjectSwitcherKeys}
  />
  <div class="project-list">
    {#each filteredProjects as project, index}
      <div 
        class="project-item"
        class:selected={selectedIndex === index}
        on:click={() => selectProject(project.id)}
      >
        <span class="project-number">{index + 1}</span>
        <span class="project-name">{project.name}</span>
        <span class="project-path">{project.path}</span>
        <span class="project-status">
          {project.contexts.activeContext} | 
          {project.state.lastCommand || 'idle'}
        </span>
      </div>
    {/each}
  </div>
</div>
```

## State Management

```typescript
// stores/projectStore.ts
import { writable, derived, get } from 'svelte/store';

// Core project store
export const projects = writable<Map<string, Project>>(new Map());
export const activeProjectId = writable<string>('');

// Derived stores
export const activeProject = derived(
  [projects, activeProjectId],
  ([$projects, $activeId]) => $projects.get($activeId)
);

export const projectList = derived(
  projects,
  $projects => Array.from($projects.values())
);

// Actions
export function createProject(name: string, path?: string): string {
  const id = generateProjectId();
  const newProject: Project = {
    id,
    name,
    path: path || `/workspace/${name}`,
    contexts: {
      terminal: createTerminalContext(),
      chat: createChatContext(),
      activeContext: 'terminal',
      contextHistory: []
    },
    metadata: {
      createdAt: new Date(),
      lastAccessed: new Date(),
      color: generateProjectColor(),
      tags: []
    },
    state: {
      isActive: true,
      isRunning: false,
      hasUnsavedChanges: false
    }
  };
  
  projects.update(p => {
    p.set(id, newProject);
    return p;
  });
  
  activeProjectId.set(id);
  return id;
}

export function switchProject(projectId: string) {
  const $projects = get(projects);
  if ($projects.has(projectId)) {
    activeProjectId.set(projectId);
    
    // Update last accessed
    projects.update(p => {
      const project = p.get(projectId);
      if (project) {
        project.metadata.lastAccessed = new Date();
      }
      return p;
    });
  }
}

export function switchContext(context: 'terminal' | 'chat') {
  const $activeProject = get(activeProject);
  if ($activeProject) {
    projects.update(p => {
      const project = p.get($activeProject.id);
      if (project) {
        project.contexts.contextHistory.push(project.contexts.activeContext);
        project.contexts.activeContext = context;
      }
      return p;
    });
  }
}
```

## Voice Recognition Integration

### Listening State Management

```typescript
interface ListeningState {
  isActive: boolean;        // Microphone is on
  isProcessing: boolean;    // Actually processing commands
  isPaused: boolean;        // In "stop listening" mode
  lastPauseTime?: Date;
  lastResumeTime?: Date;
}

class ListeningController {
  private state: ListeningState = {
    isActive: false,
    isProcessing: true,
    isPaused: false
  };
  
  // Always check these commands, even when paused
  private readonly OVERRIDE_COMMANDS = [
    'start listening',
    'start',
    'unmute',
    'wake up',
    'resume'
  ];
  
  processTranscript(transcript: string): boolean {
    const normalized = transcript.toLowerCase().trim();
    
    // Check for resume commands (always processed)
    if (this.OVERRIDE_COMMANDS.some(cmd => normalized.includes(cmd))) {
      this.resume();
      return true;
    }
    
    // If paused, ignore everything else
    if (this.state.isPaused) {
      return false; // Signal to ignore this input
    }
    
    // Check for pause commands
    if (this.shouldPause(normalized)) {
      this.pause();
      return true;
    }
    
    // Normal processing
    return true;
  }
  
  private shouldPause(transcript: string): boolean {
    const pauseCommands = ['stop listening', 'stop', 'mute', 'pause listening'];
    return pauseCommands.some(cmd => transcript.includes(cmd));
  }
  
  pause() {
    this.state.isPaused = true;
    this.state.isProcessing = false;
    this.state.lastPauseTime = new Date();
    this.updateUI('paused');
    this.playSound('pause');
    this.showNotification('Listening paused. Say "start listening" to resume.');
  }
  
  resume() {
    this.state.isPaused = false;
    this.state.isProcessing = true;
    this.state.lastResumeTime = new Date();
    this.updateUI('active');
    this.playSound('resume');
    this.showNotification('Listening resumed');
  }
}
```

### Enhanced Voice Command Processing

```typescript
// Enhanced voice command processing
interface ProjectVoiceCommand {
  type: 'project-switch' | 'project-list' | 'project-new' | 'context-switch' | 'listening-control';
  target?: string;
  action?: string;
}

function parseProjectVoiceCommand(transcript: string): ProjectVoiceCommand | null {
  const normalized = transcript.toLowerCase().trim();
  
  // Listening control commands (highest priority)
  if (normalized === 'stop listening' || normalized === 'stop' || normalized === 'mute') {
    return { type: 'listening-control', action: 'pause' };
  }
  
  if (normalized === 'start listening' || normalized === 'start' || normalized === 'unmute') {
    return { type: 'listening-control', action: 'resume' };
  }
  
  if (normalized === 'are you listening' || normalized === 'listening status') {
    return { type: 'listening-control', action: 'status' };
  }
  
  // Project switching patterns
  if (normalized.includes('switch to project') || normalized.includes('go to project')) {
    const projectName = extractProjectName(normalized);
    return { type: 'project-switch', target: projectName };
  }
  
  // Quick project access
  if (/^project [a-c]$/i.test(normalized)) {
    const letter = normalized.split(' ')[1];
    const index = letter.charCodeAt(0) - 97; // a=0, b=1, c=2
    return { type: 'project-switch', target: `index:${index}` };
  }
  
  // List projects
  if (normalized === 'list projects' || normalized === 'show projects') {
    return { type: 'project-list' };
  }
  
  // New project
  if (normalized.startsWith('new project')) {
    const name = normalized.replace('new project', '').trim();
    return { type: 'project-new', target: name || 'Untitled' };
  }
  
  // Context switching within project
  if (normalized === 'terminal' || normalized === 'console') {
    return { type: 'context-switch', target: 'terminal' };
  }
  
  if (normalized === 'chat' || normalized === 'ai' || normalized === 'assistant') {
    return { type: 'context-switch', target: 'chat' };
  }
  
  return null;
}
```

## Keyboard Shortcuts

```typescript
const projectKeyboardShortcuts = {
  // Project switching
  'Cmd+1-9': 'Switch to project 1-9',
  'Cmd+T': 'New project tab',
  'Cmd+W': 'Close current project',
  'Cmd+Shift+]': 'Next project',
  'Cmd+Shift+[': 'Previous project',
  'Cmd+K': 'Open project switcher',
  
  // Context switching within project
  'Cmd+\\': 'Toggle between terminal and chat',
  'Cmd+Enter': 'Focus terminal',
  'Cmd+Shift+Enter': 'Focus chat',
  
  // Project management
  'Cmd+Shift+P': 'Project command palette',
  'Cmd+,': 'Project settings',
  'Cmd+Shift+S': 'Save project state'
};
```

## Persistence & Session Management

```typescript
interface ProjectSession {
  version: string;
  projects: SerializedProject[];
  activeProjectId: string;
  timestamp: Date;
}

// Save session
function saveProjectSession() {
  const session: ProjectSession = {
    version: '1.0.0',
    projects: serializeProjects(get(projects)),
    activeProjectId: get(activeProjectId),
    timestamp: new Date()
  };
  
  localStorage.setItem('voice-terminal-session', JSON.stringify(session));
}

// Restore session
function restoreProjectSession() {
  const saved = localStorage.getItem('voice-terminal-session');
  if (saved) {
    const session: ProjectSession = JSON.parse(saved);
    
    // Restore projects
    session.projects.forEach(p => {
      const project = deserializeProject(p);
      projects.update(ps => {
        ps.set(project.id, project);
        return ps;
      });
    });
    
    // Restore active project
    activeProjectId.set(session.activeProjectId);
  }
}

// Auto-save on changes
projects.subscribe(() => {
  saveProjectSession();
});
```

## Visual Indicators

### Listening State Indicators
```svelte
<!-- Global listening status bar -->
<div class="listening-status-bar" class:paused={$listeningState.isPaused}>
  <div class="listening-indicator">
    {#if $listeningState.isPaused}
      <span class="status-icon paused">⏸️</span>
      <span class="status-text">Paused - Say "start listening" to resume</span>
    {:else if $listeningState.isActive}
      <span class="status-icon active">🎤</span>
      <span class="status-text">Listening</span>
      <div class="voice-visualizer">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </div>
    {:else}
      <span class="status-icon inactive">🔇</span>
      <span class="status-text">Microphone off</span>
    {/if}
  </div>
</div>
```

### Visual States
- **Active Listening**: Green microphone icon with animated voice bars
- **Paused**: Yellow/orange pause icon with clear message
- **Microphone Off**: Gray muted icon
- **Processing**: Pulsing animation while processing command

### Project Status Colors
- **Green dot**: Running processes
- **Yellow dot**: Has unsaved changes
- **Red dot**: Has errors
- **Blue dot**: Active/focused
- **Gray**: Idle

### Tab Styling
```css
.project-tab {
  position: relative;
  padding: 0.5rem 1rem;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.project-tab.active {
  border-bottom-color: var(--project-color);
  background: rgba(255, 255, 255, 0.05);
}

.project-tab.running::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  background: #00ff00;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.project-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.5rem;
}
```

## Implementation Phases

### Phase 1: Core Multi-Project Structure
- [ ] Create ProjectManager class
- [ ] Implement project store
- [ ] Build basic tab UI
- [ ] Add project creation/deletion

### Phase 2: Context Isolation
- [ ] Separate terminal contexts per project
- [ ] Separate chat contexts per project
- [ ] Implement context switching within project
- [ ] Add context state persistence

### Phase 3: Voice & Keyboard Control
- [ ] Add voice commands for project switching
- [ ] Implement keyboard shortcuts
- [ ] Create project switcher modal
- [ ] Add fuzzy search for projects

### Phase 4: Advanced Features
- [ ] Project templates
- [ ] Project grouping/workspaces
- [ ] Shared contexts between projects
- [ ] Project-specific AI prompts
- [ ] Cross-project command execution

## Benefits

1. **Parallel Work**: Run multiple projects simultaneously
2. **Context Preservation**: Each project maintains its state
3. **Quick Switching**: Voice or keyboard navigation
4. **Visual Organization**: Color-coded tabs
5. **Reduced Cognitive Load**: Clear project boundaries

## Example Workflow

```
User: "New project frontend"
System: Creates Project A (Frontend) tab

User: "npm run dev"
System: Runs in Project A terminal

User: "New project backend" 
System: Creates Project B (Backend) tab

User: "cd api && npm start"
System: Runs in Project B terminal

User: "Switch to project frontend"
System: Activates Project A tab

User: "Chat"
System: Switches to chat context in Project A

User: "How do I optimize this React component?"
System: AI responds in Project A chat context

User: "List projects"
System: Shows:
  1. Frontend (terminal) - running
  2. Backend (terminal) - running
  
User: "Project 2"
System: Switches to Backend project
```