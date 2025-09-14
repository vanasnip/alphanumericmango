# Voice Terminal Hybrid

A voice-controlled terminal interface prototype built with Svelte 5 and the Web Speech API.

## Features

- 🎤 **Voice Recognition**: Uses browser's native Web Speech API for voice input
- 🖥️ **Terminal Interface**: Classic terminal look and feel with green-on-black styling
- 📝 **Command Processing**: Mock terminal commands with typewriter effects
- 🎯 **Real-time Feedback**: Live transcript display with confidence scores
- ⌨️ **Keyboard Support**: Full keyboard navigation with command history
- 🎨 **Smooth Animations**: Built-in Svelte transitions for enhanced UX

## Available Commands

- `help` - Show available commands
- `date` - Show current date
- `time` - Show current time
- `status` - Show system status
- `clear` - Clear terminal output
- `whoami` - Show current user
- `uptime` - Show system uptime
- `echo <text>` - Echo back input text

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:5173`

4. **Try voice input:**
   - Click the microphone button
   - Allow microphone access when prompted
   - Speak a command (e.g., "help", "show date")
   - Watch it execute automatically!

## Browser Support

Voice recognition requires a modern browser with Web Speech API support:
- Chrome/Chromium (recommended)
- Edge
- Safari (limited support)
- Firefox (limited support)

## Technical Stack

- **Framework**: Svelte 5
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Pure CSS (no frameworks)
- **Voice API**: Web Speech API
- **Animations**: Svelte transitions

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   └── Terminal.svelte      # Main terminal component
│   ├── types.ts                 # TypeScript interfaces
│   ├── mockCommands.ts          # Command processing logic
│   ├── voiceRecognition.ts      # Speech API wrapper
│   └── index.ts                 # Library exports
├── routes/
│   ├── +layout.svelte           # App layout
│   └── +page.svelte             # Main page
├── app.css                      # Global styles
├── app.d.ts                     # Type declarations
└── app.html                     # HTML template
```

## Voice Recognition Flow

1. User clicks microphone button
2. Browser requests microphone permission
3. Speech recognition starts listening
4. Real-time transcript appears with confidence score
5. Final transcript is converted to terminal command
6. Command executes with visual feedback

## Customization

### Adding New Commands

Edit `src/lib/mockCommands.ts`:

```typescript
export const mockCommands: Record<string, MockCommand> = {
  mycommand: {
    name: 'mycommand',
    description: 'My custom command',
    handler: () => 'Custom output here'
  }
};
```

### Styling

All styles are in pure CSS. Main files:
- `src/app.css` - Global terminal styles
- `src/lib/components/Terminal.svelte` - Component-specific styles

### Voice Recognition Settings

Modify `src/lib/voiceRecognition.ts` to adjust:
- Language (`recognition.lang`)
- Continuous listening (`recognition.continuous`)
- Interim results (`recognition.interimResults`)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Preview production build
npm run preview
```

## Notes

- This is a UI/UX prototype with mock data - not a real terminal
- Voice recognition works best in quiet environments
- Microphone permission is required for voice features
- Commands are case-insensitive
- Command history available with up/down arrows

## Browser Compatibility

The Web Speech API support varies by browser:
- **Chrome**: Full support
- **Edge**: Full support  
- **Safari**: Partial support (iOS/macOS)
- **Firefox**: Limited support

For best experience, use Chrome or Chromium-based browsers.