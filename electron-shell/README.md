# Electron Shell for Voice Terminal

## Quick Start

### Option 1: Automatic (Recommended)
```bash
./start.sh
```
This will:
- Check if Svelte dev server is running
- Start it if needed
- Build and launch Electron

### Option 2: Manual

1. **Start Svelte terminal dev server:**
```bash
cd ../voice-terminal-hybrid
npm run dev
```

2. **Start Electron:**
```bash
npm run build
npm start
```

## Features

- **Voice Terminal**: Advanced Svelte terminal with voice navigation
- **Hot Reload**: Works with dev server
- **IPC Ready**: Prepared for tmux and voice integration
- **Performance Optimized**: Uses VS Code patterns from research
  - IPC batching (50ms windows)
  - Process isolation (sandboxed renderer)
  - Memory monitoring
  - Context isolation for security

## Architecture

```
main/
├── index.ts       # Main process with prototype switcher
├── preload.js     # Secure IPC bridge
└── services/      # (future) tmux, voice, etc.

renderer/
├── react/         # React prototype (when built)
└── svelte/        # Svelte prototype (when built)
```

## Performance Metrics

Menu: `Developer > Show Performance Metrics`

Shows:
- Heap memory usage
- RSS (total memory)
- CPU usage

## Next Steps

1. Test both prototypes in Electron
2. Choose the best one (Svelte recommended - 70% complete)
3. Integrate tmux controller
4. Add voice engine
5. Implement IPC batching