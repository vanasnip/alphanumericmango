# Parallel Development Guide - AlphanumericMango

## Git Worktree Structure Created

Your parallel development environment is now set up with 4 independent worktrees:

```
/Users/ivan/DEV_/
├── alphanumericmango/         [main] - Primary repository
├── alphanumeric-storybook/    [feature/storybook] - Component development
├── alphanumeric-voice/        [feature/voice-engine] - Voice engine module
├── alphanumeric-tmux/         [feature/tmux] - Terminal integration
└── alphanumeric-electron/     [feature/electron] - Desktop shell
```

## Terminal Setup Commands

Open 4 separate terminal windows/tabs and run:

### Terminal 1: Storybook Component Development
```bash
cd /Users/ivan/DEV_/alphanumeric-storybook/voice-terminal-hybrid
npm install
npm run storybook
# Opens at http://localhost:6006
```
**Work Focus**: 
- Develop UI components in isolation
- Create component documentation
- Test theme variations
- No backend dependencies

### Terminal 2: Voice Engine Module
```bash
cd /Users/ivan/DEV_/alphanumeric-voice/modules/voice-engine
npm install
npm run dev
```
**Work Focus**:
- Implement Whisper.cpp integration
- Add Coqui TTS
- Build voice activity detection
- Performance optimization

### Terminal 3: Tmux Controller Module
```bash
cd /Users/ivan/DEV_/alphanumeric-tmux/modules/tmux-controller
npm install
npm run dev
```
**Work Focus**:
- Complete terminal session management
- Implement command execution pipeline
- Add output streaming
- Session persistence

### Terminal 4: Electron Desktop Shell
```bash
cd /Users/ivan/DEV_/alphanumeric-electron/electron-shell
npm install
npm run dev
```
**Work Focus**:
- Enhance IPC communication
- Implement menu system
- Add performance monitoring
- Window management

## Workflow Benefits

### 🚀 **Velocity Improvements**
- **No blocking**: Each stream works independently
- **Parallel builds**: Different build processes don't interfere
- **Fast switching**: Alt-tab between focused work areas
- **Load balancing**: Work on one area while another compiles

### 📊 **Development Strategy**

#### Phase 1: Foundation (Week 1)
**Parallel Tasks:**
- **Storybook**: Build component library
- **Voice Engine**: Core processing setup
- **Tmux**: Basic session management
- **Electron**: IPC foundation

#### Phase 2: Integration (Week 2)
**Sequential Tasks:**
- Merge component updates to main
- Connect voice engine to UI
- Wire tmux to terminal display
- Complete Electron integration

#### Phase 3: Polish (Week 3)
**Optimization Tasks:**
- Performance tuning
- Cross-platform testing
- Documentation
- Release preparation

## Git Workflow

### Daily Sync Pattern
```bash
# In each worktree, pull latest main
git fetch origin
git rebase origin/main

# Push feature branch
git push origin feature/[branch-name]
```

### Merging Work
```bash
# From main repository
cd /Users/ivan/DEV_/alphanumericmango
git pull origin main
git merge --no-ff feature/storybook
git merge --no-ff feature/voice-engine
git merge --no-ff feature/tmux
git merge --no-ff feature/electron
```

## Quick Status Check

Run this from any location to see all worktree status:
```bash
git worktree list --porcelain
```

## Performance Monitoring

### Track Progress Across Streams
- **Storybook**: Component completion rate
- **Voice Engine**: Processing latency (<100ms target)
- **Tmux**: Command execution speed (<20ms target)
- **Electron**: Memory usage and startup time

## Team Coordination

### Morning Sync
1. Check status of all worktrees
2. Identify integration points
3. Plan day's parallel work
4. Set merge targets

### Evening Merge
1. Push all feature branches
2. Create PRs for review
3. Plan next day's work
4. Document blockers

## Troubleshooting

### Port Conflicts
- Storybook: 6006
- Voice Terminal: 5174
- Electron: Uses Svelte dev server
- Module dev servers: Various (check package.json)

### Build Issues
Each worktree has independent node_modules:
```bash
# Clean rebuild in any worktree
rm -rf node_modules package-lock.json
npm install
```

### Worktree Management
```bash
# Remove a worktree
git worktree remove alphanumeric-[name]

# Prune stale worktrees
git worktree prune
```

## Success Metrics

Track velocity improvements:
- **Components/day**: Target 3-5 completed components
- **Module features/day**: Target 2-3 features
- **Integration tests**: All passing before merge
- **Build time**: <30s for incremental builds

---

**Ready to accelerate!** Each terminal can now work independently while you orchestrate across all streams.