# Electron Shell for Project X

## Quick Start

### 1. Start your prototype dev server:

**For React prototype:**
```bash
cd ../project-x-prototype
npm run dev
```

**For Svelte terminal (recommended):**
```bash
cd ../voice-terminal-hybrid
npm run dev -- --port 5174
```

### 2. Start Electron:

```bash
# Default (loads Svelte)
npm run dev

# Or specify prototype
PROTOTYPE=react npm run dev
PROTOTYPE=svelte npm run dev
```

## Features

- **Flexible Loading**: Can load either React or Svelte prototype
- **Hot Reload**: Works with dev servers
- **IPC Ready**: Prepared for tmux and voice integration
- **Performance Optimized**: Uses VS Code patterns from research
  - IPC batching (50ms windows)
  - Process isolation
  - Memory monitoring

## Switching Prototypes

Use the menu: `Prototype > Switch to [React/Svelte]`

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