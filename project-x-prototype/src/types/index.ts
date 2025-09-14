export type OutputLineType = 'command' | 'output' | 'error' | 'success';

export interface OutputLine {
  id: string;
  text: string;
  type: OutputLineType;
  timestamp: number;
}

export interface ParsedCommand {
  raw: string;
  command: string;
  confidence: number;
  risk: 'safe' | 'moderate' | 'dangerous';
}

export interface Project {
  id: string;
  name: string;
  path: string;
  lastCommand: string;
  context: string[];
}

export interface VoiceState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  noiseLevel: number;
}

export interface AIResponse {
  summary: string;
  hasErrors: boolean;
  suggestions?: string[];
  timestamp: number;
}