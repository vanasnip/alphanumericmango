# Voice-Terminal Hybrid Application: Complete Screen & Wireframe Design Prompt

## Application Overview
Design a complete set of screens and wireframes for a voice-controlled terminal and AI chat hybrid application that supports multiple project contexts. The application combines traditional terminal functionality with conversational AI, all controlled through voice commands and visual interfaces.

## Core Screens to Design

### 1. Main Dashboard / Home Screen
- **Project Overview Grid**: Visual cards showing all active projects with status indicators
- **Quick Actions Panel**: Voice command shortcuts, recent projects, frequently used commands
- **Global Status Bar**: Listening state, active connections, system resources
- **Welcome/Onboarding Flow**: First-time user experience with voice setup

### 2. Multi-Project Workspace (Primary Interface)
- **Tab Bar**: Horizontal tabs for each project with visual indicators:
  - Color coding for project identification
  - Running status dots (green=running, yellow=warning, red=error)
  - Close buttons and drag-to-reorder capability
  - "+" button for new projects
- **Split Panel Layout**:
  - Terminal panel (left/top)
  - AI Chat panel (right/bottom)
  - Draggable divider for resizing
  - Toggle buttons for single/split view
- **Context Switcher**: Visual toggle between Terminal/Chat/Both views

### 3. Terminal Interface Variations
- **Classic Terminal**: Traditional black/green phosphor look
- **Modern Terminal**: Sleek with syntax highlighting and inline previews
- **Voice-First Terminal**: Large text, voice command hints, visual feedback for voice input
- **Compact Terminal**: Minimal UI for maximum content visibility

### 4. AI Chat Interface Variations
- **Conversational View**: Message bubbles with typing indicators
- **Document View**: Formatted responses with code blocks and markdown
- **Collaborative View**: Side-by-side code editor and chat
- **Voice Transcript View**: Real-time transcription with confidence indicators

### 5. Voice Command Overlay
- **Listening States**:
  - Active listening (animated waveform)
  - Paused (dimmed with "Say 'start listening' to resume")
  - Processing (pulsing indicator)
  - Error state (red with retry option)
- **Command Palette**: Floating overlay showing:
  - Available voice commands
  - Recent commands history
  - Command suggestions based on context
- **Voice Feedback**: Visual confirmation of recognized commands

### 6. Settings & Configuration
- **Voice Settings**:
  - Microphone selection and testing
  - Voice activation sensitivity
  - Wake word configuration
  - Language and accent settings
- **Terminal Settings**:
  - Shell selection
  - Font and color schemes
  - Keyboard shortcuts
- **AI Settings**:
  - Model selection
  - Context window size
  - System prompts per project
- **Theme Settings**:
  - Preset themes gallery
  - Custom theme builder with live preview
  - Import/export themes

### 7. Project Management Screens
- **Project Switcher Modal**: 
  - Searchable list with fuzzy matching
  - Project previews showing last activity
  - Keyboard navigation (Cmd+K style)
- **New Project Wizard**:
  - Template selection
  - Path configuration
  - Initial setup options
- **Project Settings**:
  - Environment variables
  - Run configurations
  - Project-specific shortcuts

### 8. Navigation Components
- **Command Bar**: Top bar with breadcrumbs and quick actions
- **Sidebar Options**:
  - Collapsible file tree
  - Project list
  - Tool panels
- **Bottom Status Bar**: 
  - Current directory
  - Git branch
  - Process status
  - Voice listening indicator

### 9. Modal Dialogs & Overlays
- **Quick Switcher** (Cmd+K): Universal search for projects, files, commands
- **Help Modal**: Interactive command reference with examples
- **Notification Toast**: Non-intrusive alerts for background tasks
- **Context Menu**: Right-click options for terminal text and chat messages

### 10. Responsive Variations
- **Desktop (1920x1080)**: Full featured with all panels
- **Laptop (1440x900)**: Optimized spacing, collapsible panels
- **Tablet (1024x768)**: Touch-optimized, larger buttons
- **Mobile (375x812)**: Single panel view with swipe navigation

## Special States to Illustrate

### Empty States
- No projects open
- Empty terminal
- New chat conversation
- No voice input detected

### Loading States
- Project loading
- Command executing
- AI thinking/generating
- Voice processing

### Error States
- Microphone permission denied
- Connection lost
- Command failed
- Project crash

### Success States
- Command completed
- Build successful
- Tests passing
- Voice command recognized

## Interaction Flows to Map

1. **First Launch Flow**: Setup → Permissions → Tutorial → First Project
2. **Voice Command Flow**: Wake → Listen → Process → Execute → Feedback
3. **Project Switching Flow**: Current → Switcher → Select → Load → Active
4. **Terminal-to-Chat Flow**: Terminal command → Error → Ask AI → Get solution → Apply
5. **Multi-Project Flow**: Project A active → Create Project B → Switch between → Run commands in both

## Visual Design Requirements

### Color Schemes
- **Dark Theme**: Primary with high contrast for extended use
- **Light Theme**: Clean and minimal for daytime work
- **High Contrast**: Accessibility-focused with clear boundaries
- **Custom Themes**: User-definable with color picker

### Typography
- **Terminal Font**: Monospace (JetBrains Mono, Fira Code)
- **UI Font**: System font or Inter for interface elements
- **Voice Feedback Font**: Large, clear sans-serif for transcription

### Iconography
- Voice state icons (listening, paused, muted)
- Project type icons
- Status indicators
- Action buttons

### Animations
- Voice waveform visualization
- Tab switching transitions
- Panel resize animations
- Command execution feedback

## Accessibility Features

- **Voice-First Navigation**: Complete app control via voice
- **Keyboard Navigation**: Full keyboard support with visible focus indicators
- **Screen Reader Support**: Proper ARIA labels and announcements
- **Visual Indicators**: Multiple ways to convey information (color + icon + text)
- **Customizable Contrast**: User-adjustable contrast levels
- **Text Scaling**: Adjustable font sizes throughout

## Unique Features to Showcase

1. **Voice Number Badges**: Visual numbers overlay for voice selection ("Select 3")
2. **Smart Context Switching**: AI understands when to switch from terminal to chat
3. **Parallel Execution Indicator**: Visual feedback when commands run across projects
4. **Voice Command Chaining**: Visual representation of multi-step voice commands
5. **Project Status Dashboard**: Bird's eye view of all project activities
6. **Collaborative Mode**: Multiple users can voice-control the same session
7. **Time Travel Debugging**: Visual timeline of commands and states
8. **AI Code Suggestions**: Inline AI completions in terminal

## Deliverables

Create wireframes and mockups for:
1. **5 Complete User Flows** (from start to finish)
2. **15 Core Screens** (fully detailed)
3. **3 Theme Variations** (dark, light, custom)
4. **Mobile Responsive Versions** (for key screens)
5. **Component Library**: Buttons, inputs, cards, modals
6. **Interaction Prototypes**: Showing voice feedback and animations
7. **Style Guide**: Colors, typography, spacing, shadows

## Innovation Opportunities

Consider these cutting-edge features:
- **Spatial Audio Feedback**: 3D audio cues for different projects
- **Gesture Control**: Hand gestures via webcam for navigation
- **AR Mode**: Project information overlay in AR glasses
- **Biometric Stress Detection**: Adjust UI based on user stress levels
- **Predictive Commands**: AI predicts next command based on patterns
- **Emotion-Aware Responses**: AI adjusts tone based on user sentiment
- **Collaborative Cursors**: See where team members are working
- **Voice Personas**: Different AI voices for different project types

---

This prompt should generate comprehensive designs covering all aspects of your voice-terminal hybrid application. Each screen should consider both the functional requirements and the unique voice-first interaction paradigm.