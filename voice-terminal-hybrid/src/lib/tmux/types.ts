export interface TmuxSession {
  id: string;
  name: string;
  pid: number;
  created: Date;
  windows: TmuxWindow[];
  attached: boolean;
}

export interface TmuxWindow {
  id: string;
  index: number;
  name: string;
  active: boolean;
  panes: TmuxPane[];
}

export interface TmuxPane {
  id: string;
  index: number;
  active: boolean;
  width: number;
  height: number;
  command: string;
  pid: number;
}

export interface CommandExecution {
  sessionId: string;
  windowId: string;
  paneId: string;
  command: string;
  timestamp: number;
  executionTime?: number;
  output?: string;
  error?: string;
}

export interface PerformanceMetrics {
  commandInjectionLatency: number[];
  outputCaptureLatency: number[];
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  totalCommands: number;
  failedCommands: number;
  successRate: number;
}

export interface TmuxConfig {
  socketPath?: string;
  defaultShell?: string;
  captureBufferSize?: number;
  commandTimeout?: number;
  performanceMode?: 'balanced' | 'performance' | 'reliability';
}

export type TmuxEventType = 
  | 'session-created'
  | 'session-closed'
  | 'window-created'
  | 'window-closed'
  | 'pane-created'
  | 'pane-closed'
  | 'output-received'
  | 'command-executed';

export interface TmuxEvent {
  type: TmuxEventType;
  sessionId?: string;
  windowId?: string;
  paneId?: string;
  data: any;
  timestamp: number;
}