import { OutputLine } from '../types/index.js';

export const mockScenarios = {
  "run tests": {
    output: [
      { id: '1', text: '$ npm test', type: 'command' as const, timestamp: Date.now() },
      { id: '2', text: '', type: 'output' as const, timestamp: Date.now() + 100 },
      { id: '3', text: '> project-x@1.0.0 test', type: 'output' as const, timestamp: Date.now() + 200 },
      { id: '4', text: '> jest --coverage', type: 'output' as const, timestamp: Date.now() + 300 },
      { id: '5', text: '', type: 'output' as const, timestamp: Date.now() + 400 },
      { id: '6', text: 'PASS  src/App.test.tsx', type: 'success' as const, timestamp: Date.now() + 1000 },
      { id: '7', text: '  ✓ renders without crashing (45ms)', type: 'success' as const, timestamp: Date.now() + 1100 },
      { id: '8', text: '  ✓ displays welcome message (12ms)', type: 'success' as const, timestamp: Date.now() + 1200 },
      { id: '9', text: '', type: 'output' as const, timestamp: Date.now() + 1300 },
      { id: '10', text: 'PASS  src/utils.test.ts', type: 'success' as const, timestamp: Date.now() + 2000 },
      { id: '11', text: '  ✓ parses commands correctly (8ms)', type: 'success' as const, timestamp: Date.now() + 2100 },
      { id: '12', text: '  ✓ validates input (5ms)', type: 'success' as const, timestamp: Date.now() + 2200 },
      { id: '13', text: '', type: 'output' as const, timestamp: Date.now() + 2300 },
      { id: '14', text: 'Test Suites: 2 passed, 2 total', type: 'success' as const, timestamp: Date.now() + 3000 },
      { id: '15', text: 'Tests:       4 passed, 4 total', type: 'success' as const, timestamp: Date.now() + 3100 },
      { id: '16', text: 'Coverage:    87%', type: 'success' as const, timestamp: Date.now() + 3200 },
      { id: '17', text: 'Time:        3.24s', type: 'output' as const, timestamp: Date.now() + 3300 },
    ] as OutputLine[],
    duration: 3500,
    summary: "All 4 tests passed successfully. Test coverage is at 87%. No failures detected.",
    hasErrors: false
  },
  
  "git status": {
    output: [
      { id: '1', text: '$ git status', type: 'command' as const, timestamp: Date.now() },
      { id: '2', text: 'On branch feature/voice-control', type: 'output' as const, timestamp: Date.now() + 100 },
      { id: '3', text: 'Your branch is up to date with \'origin/feature/voice-control\'.', type: 'output' as const, timestamp: Date.now() + 200 },
      { id: '4', text: '', type: 'output' as const, timestamp: Date.now() + 300 },
      { id: '5', text: 'Changes to be committed:', type: 'success' as const, timestamp: Date.now() + 400 },
      { id: '6', text: '  (use "git restore --staged <file>..." to unstage)', type: 'output' as const, timestamp: Date.now() + 500 },
      { id: '7', text: '        modified:   src/components/Terminal.tsx', type: 'success' as const, timestamp: Date.now() + 600 },
      { id: '8', text: '', type: 'output' as const, timestamp: Date.now() + 700 },
      { id: '9', text: 'Changes not staged for commit:', type: 'error' as const, timestamp: Date.now() + 800 },
      { id: '10', text: '  (use "git add <file>..." to update what will be committed)', type: 'output' as const, timestamp: Date.now() + 900 },
      { id: '11', text: '        modified:   src/App.tsx', type: 'error' as const, timestamp: Date.now() + 1000 },
      { id: '12', text: '        modified:   README.md', type: 'error' as const, timestamp: Date.now() + 1100 },
      { id: '13', text: '', type: 'output' as const, timestamp: Date.now() + 1200 },
      { id: '14', text: 'Untracked files:', type: 'output' as const, timestamp: Date.now() + 1300 },
      { id: '15', text: '  (use "git add <file>..." to include in what will be committed)', type: 'output' as const, timestamp: Date.now() + 1400 },
      { id: '16', text: '        src/hooks/useVoice.ts', type: 'output' as const, timestamp: Date.now() + 1500 },
    ] as OutputLine[],
    duration: 500,
    summary: "1 file staged for commit, 2 files with unstaged changes, and 1 untracked file. Ready to commit Terminal.tsx changes.",
    hasErrors: false
  },

  "build project": {
    output: [
      { id: '1', text: '$ npm run build', type: 'command' as const, timestamp: Date.now() },
      { id: '2', text: '', type: 'output' as const, timestamp: Date.now() + 100 },
      { id: '3', text: '> project-x@1.0.0 build', type: 'output' as const, timestamp: Date.now() + 200 },
      { id: '4', text: '> vite build', type: 'output' as const, timestamp: Date.now() + 300 },
      { id: '5', text: '', type: 'output' as const, timestamp: Date.now() + 400 },
      { id: '6', text: 'vite v5.0.0 building for production...', type: 'output' as const, timestamp: Date.now() + 500 },
      { id: '7', text: 'transforming...', type: 'output' as const, timestamp: Date.now() + 2000 },
      { id: '8', text: '', type: 'output' as const, timestamp: Date.now() + 4000 },
      { id: '9', text: 'ERROR: TypeScript compilation failed', type: 'error' as const, timestamp: Date.now() + 5000 },
      { id: '10', text: '', type: 'output' as const, timestamp: Date.now() + 5100 },
      { id: '11', text: 'src/App.tsx:42:5 - error TS2322: Type \'string\' is not assignable to type \'number\'.', type: 'error' as const, timestamp: Date.now() + 5200 },
      { id: '12', text: '', type: 'output' as const, timestamp: Date.now() + 5300 },
      { id: '13', text: '42     const count: number = "0";', type: 'error' as const, timestamp: Date.now() + 5400 },
      { id: '14', text: '       ~~~~~', type: 'error' as const, timestamp: Date.now() + 5500 },
      { id: '15', text: '', type: 'output' as const, timestamp: Date.now() + 5600 },
      { id: '16', text: 'Found 1 error. Build failed.', type: 'error' as const, timestamp: Date.now() + 5700 },
    ] as OutputLine[],
    duration: 6000,
    summary: "Build failed due to TypeScript error. Type mismatch in App.tsx line 42: string assigned to number type.",
    hasErrors: true
  },

  "ask claude": {
    output: [
      { id: '1', text: '$ # Asking Claude to explain the error...', type: 'command' as const, timestamp: Date.now() },
      { id: '2', text: '', type: 'output' as const, timestamp: Date.now() + 500 },
      { id: '3', text: 'Claude: The error occurs because you\'re trying to assign a string value "0" to a variable explicitly typed as number.', type: 'success' as const, timestamp: Date.now() + 1000 },
      { id: '4', text: '', type: 'output' as const, timestamp: Date.now() + 1100 },
      { id: '5', text: 'To fix this, change line 42 from:', type: 'output' as const, timestamp: Date.now() + 1200 },
      { id: '6', text: '  const count: number = "0";', type: 'error' as const, timestamp: Date.now() + 1300 },
      { id: '7', text: '', type: 'output' as const, timestamp: Date.now() + 1400 },
      { id: '8', text: 'To:', type: 'output' as const, timestamp: Date.now() + 1500 },
      { id: '9', text: '  const count: number = 0;', type: 'success' as const, timestamp: Date.now() + 1600 },
      { id: '10', text: '', type: 'output' as const, timestamp: Date.now() + 1700 },
      { id: '11', text: 'Remove the quotes to make it a numeric literal instead of a string.', type: 'output' as const, timestamp: Date.now() + 1800 },
    ] as OutputLine[],
    duration: 2000,
    summary: "Remove quotes from '0' on line 42 to fix the type error. Change string to number literal.",
    hasErrors: false
  }
};

export const commandMappings: Record<string, string> = {
  "run tests": "npm test",
  "run the tests": "npm test",
  "test": "npm test",
  "git status": "git status",
  "check git": "git status",
  "what's changed": "git status",
  "build": "npm run build",
  "build project": "npm run build",
  "build the project": "npm run build",
  "ask claude": "claude",
  "help": "claude",
  "explain error": "claude"
};