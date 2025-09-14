import React, { useState, useCallback, useEffect } from 'react';
import Terminal from './components/Terminal/Terminal.js';
import VoiceIndicator from './components/Voice/VoiceIndicator.js';
import CommandPreview from './components/Command/CommandPreview.js';
import SummaryCard from './components/AI/SummaryCard.js';
import ProjectSwitcher from './components/Project/ProjectSwitcher.js';
import { useVoiceRecognition } from './hooks/useVoiceRecognition.js';
import { mockScenarios } from './data/mockResponses.js';
import { OutputLine, ParsedCommand, Project, AIResponse } from './types/index.js';

function App() {
  // State management
  const [terminalLines, setTerminalLines] = useState<OutputLine[]>([
    { id: '0', text: 'Project X Voice Terminal - Prototype v1.0', type: 'success', timestamp: Date.now() },
    { id: '1', text: 'Ready for voice commands. Say "Hey Terminal" or press spacebar.', type: 'output', timestamp: Date.now() },
    { id: '2', text: '', type: 'output', timestamp: Date.now() },
  ]);
  
  const [currentCommand, setCurrentCommand] = useState<ParsedCommand | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Project state
  const [projects] = useState<Project[]>([
    { id: '1', name: 'frontend-app', path: '~/projects/frontend-app', lastCommand: 'npm test', context: [] },
    { id: '2', name: 'backend-api', path: '~/projects/backend-api', lastCommand: 'git status', context: [] },
    { id: '3', name: 'mobile-app', path: '~/projects/mobile-app', lastCommand: 'build project', context: [] },
  ]);
  const [currentProject, setCurrentProject] = useState<Project>(projects[0]);

  // Voice recognition hook
  const {
    isListening,
    transcript,
    interimTranscript,
    toggleListening,
    clearTranscript,
    parseCommand,
  } = useVoiceRecognition();

  // Parse voice commands
  useEffect(() => {
    if (transcript && !currentCommand) {
      const parsed = parseCommand(transcript);
      if (parsed) {
        setCurrentCommand(parsed);
        clearTranscript();
      }
    }
  }, [transcript, currentCommand, parseCommand, clearTranscript]);

  // Listen for "execute" command
  useEffect(() => {
    if (currentCommand && transcript.toLowerCase().includes('execute')) {
      executeCommand();
      clearTranscript();
    }
  }, [transcript, currentCommand]);

  // Execute command simulation
  const executeCommand = useCallback(() => {
    if (!currentCommand) return;

    setIsExecuting(true);
    setCurrentCommand(null);
    
    // Find matching scenario
    const scenarioKey = Object.keys(mockScenarios).find(key => 
      currentCommand.command.includes(key) || key.includes(currentCommand.command.split(' ')[0])
    );
    
    const scenario = mockScenarios[scenarioKey as keyof typeof mockScenarios] || mockScenarios['git status'];
    
    // Simulate command execution with typewriter effect
    let lineIndex = 0;
    const interval = setInterval(() => {
      if (lineIndex < scenario.output.length) {
        setTerminalLines(prev => [...prev, scenario.output[lineIndex]]);
        lineIndex++;
      } else {
        clearInterval(interval);
        setIsExecuting(false);
        
        // Simulate AI summary generation
        setIsAiLoading(true);
        setTimeout(() => {
          setAiResponse({
            summary: scenario.summary,
            hasErrors: scenario.hasErrors,
            suggestions: scenario.hasErrors ? ['Fix the type error', 'Run tests again'] : undefined,
            timestamp: Date.now(),
          });
          setIsAiLoading(false);
        }, 1500);
      }
    }, 150);
  }, [currentCommand]);

  const cancelCommand = useCallback(() => {
    setCurrentCommand(null);
    clearTranscript();
  }, [clearTranscript]);

  const switchProject = useCallback((project: Project) => {
    setCurrentProject(project);
    setTerminalLines([
      { id: '0', text: `Switched to project: ${project.name}`, type: 'success', timestamp: Date.now() },
      { id: '1', text: `Working directory: ${project.path}`, type: 'output', timestamp: Date.now() },
      { id: '2', text: '', type: 'output', timestamp: Date.now() },
    ]);
    setAiResponse(null);
  }, []);

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="terminal-window">
          <h1 className="text-2xl font-bold text-terminal-blue mb-2">
            Project X - Voice Terminal Prototype
          </h1>
          <p className="text-sm text-gray-500">
            Test voice commands for terminal control. This is a simulation - no real commands are executed.
          </p>
        </div>

        {/* Project Switcher */}
        <ProjectSwitcher
          currentProject={currentProject}
          projects={projects}
          onSwitch={switchProject}
        />

        {/* Voice Indicator */}
        <VoiceIndicator
          isListening={isListening}
          transcript={transcript}
          interimTranscript={interimTranscript}
          onToggle={toggleListening}
        />

        {/* Command Preview */}
        <CommandPreview
          command={currentCommand}
          onExecute={executeCommand}
          onCancel={cancelCommand}
        />

        {/* Terminal */}
        <Terminal
          lines={terminalLines}
          currentDirectory={currentProject.path}
          isExecuting={isExecuting}
        />

        {/* AI Summary */}
        <SummaryCard
          response={aiResponse}
          isLoading={isAiLoading}
        />

        {/* Instructions */}
        <div className="terminal-window text-sm">
          <div className="font-medium mb-2">Try these commands:</div>
          <div className="grid grid-cols-2 gap-2 text-gray-500">
            <div>• "Run tests" - Execute test suite</div>
            <div>• "Git status" - Check repository status</div>
            <div>• "Build project" - Build with error demo</div>
            <div>• "Ask Claude" - Get AI assistance</div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Press spacebar to toggle voice recognition. Say "Execute" to run commands.
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;