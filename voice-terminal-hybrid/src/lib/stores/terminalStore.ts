import { writable, derived, get } from 'svelte/store';
import type { TmuxSession, TmuxWindow, TmuxPane, CommandExecution, PerformanceMetrics } from '../tmux/types.js';

// Terminal Connection State
export type TerminalConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Terminal Session with additional UI state
export interface TerminalSession extends TmuxSession {
  uiState: {
    isVisible: boolean;
    isActive: boolean;
    scrollPosition: number;
    fontSize: number;
    theme: string;
    voiceNavigationId?: string;
  };
  output: TerminalOutputLine[];
  connectionState: TerminalConnectionState;
  lastActivity: Date;
  performanceMetrics: PerformanceMetrics;
}

// Terminal Output Line for rendering
export interface TerminalOutputLine {
  id: string;
  timestamp: Date;
  content: string;
  type: 'command' | 'output' | 'error' | 'system';
  sessionId: string;
  windowId?: string;
  paneId?: string;
  isVisible: boolean;
}

// Command Queue Item
export interface QueuedCommand {
  id: string;
  sessionId: string;
  windowId?: string;
  paneId?: string;
  command: string;
  priority: 'low' | 'normal' | 'high';
  timestamp: Date;
  securityValidated: boolean;
  voiceInitiated: boolean;
}

// Security Configuration
export interface SecurityConfig {
  enableCommandValidation: boolean;
  allowedCommands: string[];
  blockedCommands: string[];
  requireConfirmation: string[];
  enableAuditLogging: boolean;
  maxCommandLength: number;
  rateLimitCommands: number; // commands per minute
}

// Performance Configuration
export interface PerformanceConfig {
  maxOutputLines: number;
  outputBufferSize: number;
  connectionTimeout: number;
  commandTimeout: number;
  enableMetrics: boolean;
  targetLatency: number; // <15ms requirement
}

// Terminal Store State
interface TerminalStoreState {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  commandQueue: QueuedCommand[];
  isProcessingCommands: boolean;
  globalPerformanceMetrics: PerformanceMetrics;
  securityConfig: SecurityConfig;
  performanceConfig: PerformanceConfig;
  connectionHistory: { sessionId: string; timestamp: Date; event: string }[];
}

// Default configurations
const defaultSecurityConfig: SecurityConfig = {
  enableCommandValidation: true,
  allowedCommands: ['ls', 'cd', 'pwd', 'cat', 'grep', 'find', 'ps', 'top', 'htop'],
  blockedCommands: ['rm -rf', 'sudo rm', 'format', 'del /f', 'mkfs'],
  requireConfirmation: ['sudo', 'rm', 'mv', 'cp'],
  enableAuditLogging: true,
  maxCommandLength: 500,
  rateLimitCommands: 60
};

const defaultPerformanceConfig: PerformanceConfig = {
  maxOutputLines: 1000,
  outputBufferSize: 10000,
  connectionTimeout: 5000,
  commandTimeout: 30000,
  enableMetrics: true,
  targetLatency: 15
};

const defaultPerformanceMetrics: PerformanceMetrics = {
  commandInjectionLatency: [],
  outputCaptureLatency: [],
  averageLatency: 0,
  p95Latency: 0,
  p99Latency: 0,
  totalCommands: 0,
  failedCommands: 0,
  successRate: 100
};

// Create the main terminal store
function createTerminalStore() {
  const initialState: TerminalStoreState = {
    sessions: new Map(),
    activeSessionId: null,
    commandQueue: [],
    isProcessingCommands: false,
    globalPerformanceMetrics: { ...defaultPerformanceMetrics },
    securityConfig: { ...defaultSecurityConfig },
    performanceConfig: { ...defaultPerformanceConfig },
    connectionHistory: []
  };

  const { subscribe, set, update } = writable<TerminalStoreState>(initialState);

  return {
    subscribe,
    update,

    // Session Management
    createSession: (sessionData: TmuxSession) => {
      update(state => {
        const terminalSession: TerminalSession = {
          ...sessionData,
          uiState: {
            isVisible: true,
            isActive: false,
            scrollPosition: 0,
            fontSize: 14,
            theme: 'default'
          },
          output: [],
          connectionState: 'connected' as TerminalConnectionState,
          lastActivity: new Date(),
          performanceMetrics: { ...defaultPerformanceMetrics }
        };
        
        state.sessions.set(sessionData.id, terminalSession);
        
        // Set as active if it's the first session
        if (!state.activeSessionId) {
          state.activeSessionId = sessionData.id;
          terminalSession.uiState.isActive = true;
        }
        
        // Add to connection history
        state.connectionHistory.push({
          sessionId: sessionData.id,
          timestamp: new Date(),
          event: 'session-created'
        });
        
        return state;
      });
    },

    removeSession: (sessionId: string) => {
      update(state => {
        const session = state.sessions.get(sessionId);
        if (session) {
          state.sessions.delete(sessionId);
          
          // Switch active session if needed
          if (state.activeSessionId === sessionId) {
            const remainingSessions = Array.from(state.sessions.keys());
            state.activeSessionId = remainingSessions.length > 0 ? remainingSessions[0] : null;
            
            // Activate new session
            if (state.activeSessionId) {
              const newActiveSession = state.sessions.get(state.activeSessionId);
              if (newActiveSession) {
                newActiveSession.uiState.isActive = true;
              }
            }
          }
          
          // Add to connection history
          state.connectionHistory.push({
            sessionId,
            timestamp: new Date(),
            event: 'session-removed'
          });
        }
        
        return state;
      });
    },

    setActiveSession: (sessionId: string) => {
      update(state => {
        // Deactivate current session
        if (state.activeSessionId) {
          const currentSession = state.sessions.get(state.activeSessionId);
          if (currentSession) {
            currentSession.uiState.isActive = false;
          }
        }
        
        // Activate new session
        const newSession = state.sessions.get(sessionId);
        if (newSession) {
          state.activeSessionId = sessionId;
          newSession.uiState.isActive = true;
          newSession.lastActivity = new Date();
        }
        
        return state;
      });
    },

    updateSessionConnectionState: (sessionId: string, connectionState: TerminalConnectionState) => {
      update(state => {
        const session = state.sessions.get(sessionId);
        if (session) {
          session.connectionState = connectionState;
          session.lastActivity = new Date();
          
          state.connectionHistory.push({
            sessionId,
            timestamp: new Date(),
            event: `connection-${connectionState}`
          });
        }
        return state;
      });
    },

    // Output Management
    addOutput: (sessionId: string, content: string, type: TerminalOutputLine['type'] = 'output', windowId?: string, paneId?: string) => {
      update(state => {
        const session = state.sessions.get(sessionId);
        if (session) {
          const outputLine: TerminalOutputLine = {
            id: `${sessionId}-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            content,
            type,
            sessionId,
            windowId,
            paneId,
            isVisible: true
          };
          
          session.output.push(outputLine);
          session.lastActivity = new Date();
          
          // Trim output if exceeding max lines
          if (session.output.length > state.performanceConfig.maxOutputLines) {
            session.output = session.output.slice(-state.performanceConfig.maxOutputLines);
          }
        }
        return state;
      });
    },

    clearSessionOutput: (sessionId: string) => {
      update(state => {
        const session = state.sessions.get(sessionId);
        if (session) {
          session.output = [];
        }
        return state;
      });
    },

    // Command Queue Management
    queueCommand: (command: QueuedCommand) => {
      update(state => {
        // Security validation
        if (state.securityConfig.enableCommandValidation) {
          command.securityValidated = validateCommand(command.command, state.securityConfig);
        } else {
          command.securityValidated = true;
        }
        
        // Add to queue with priority sorting
        state.commandQueue.push(command);
        state.commandQueue.sort((a, b) => {
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        return state;
      });
    },

    dequeueCommand: (): QueuedCommand | null => {
      let result: QueuedCommand | null = null;
      update(state => {
        if (state.commandQueue.length > 0) {
          result = state.commandQueue.shift() || null;
        }
        return state;
      });
      return result;
    },

    setProcessingCommands: (isProcessing: boolean) => {
      update(state => {
        state.isProcessingCommands = isProcessing;
        return state;
      });
    },

    // Performance Metrics
    updatePerformanceMetrics: (sessionId: string, metrics: Partial<PerformanceMetrics>) => {
      update(state => {
        const session = state.sessions.get(sessionId);
        if (session) {
          session.performanceMetrics = { ...session.performanceMetrics, ...metrics };
          
          // Update global metrics
          updateGlobalMetrics(state);
        }
        return state;
      });
    },

    recordCommandExecution: (execution: CommandExecution) => {
      update(state => {
        const session = state.sessions.get(execution.sessionId);
        if (session && execution.executionTime) {
          // Record latency
          session.performanceMetrics.commandInjectionLatency.push(execution.executionTime);
          session.performanceMetrics.totalCommands++;
          
          if (execution.error) {
            session.performanceMetrics.failedCommands++;
          }
          
          // Calculate success rate
          session.performanceMetrics.successRate = 
            ((session.performanceMetrics.totalCommands - session.performanceMetrics.failedCommands) / 
             session.performanceMetrics.totalCommands) * 100;
          
          // Update averages
          updateSessionAverages(session);
          updateGlobalMetrics(state);
        }
        return state;
      });
    },

    // Configuration
    updateSecurityConfig: (config: Partial<SecurityConfig>) => {
      update(state => {
        state.securityConfig = { ...state.securityConfig, ...config };
        return state;
      });
    },

    updatePerformanceConfig: (config: Partial<PerformanceConfig>) => {
      update(state => {
        state.performanceConfig = { ...state.performanceConfig, ...config };
        return state;
      });
    },

    // UI State Management
    updateSessionUIState: (sessionId: string, uiState: Partial<TerminalSession['uiState']>) => {
      update(state => {
        const session = state.sessions.get(sessionId);
        if (session) {
          session.uiState = { ...session.uiState, ...uiState };
        }
        return state;
      });
    },

    // Utility
    reset: () => {
      set(initialState);
    },

    getSessionById: (sessionId: string): TerminalSession | undefined => {
      const state = get({ subscribe });
      return state.sessions.get(sessionId);
    }
  };
}

// Helper functions
function validateCommand(command: string, config: SecurityConfig): boolean {
  // Length check
  if (command.length > config.maxCommandLength) {
    return false;
  }
  
  // Blocked commands check
  for (const blocked of config.blockedCommands) {
    if (command.toLowerCase().includes(blocked.toLowerCase())) {
      return false;
    }
  }
  
  // If allowed commands are specified, check against them
  if (config.allowedCommands.length > 0) {
    const commandBase = command.split(' ')[0];
    return config.allowedCommands.includes(commandBase);
  }
  
  return true;
}

function updateSessionAverages(session: TerminalSession) {
  const latencies = session.performanceMetrics.commandInjectionLatency;
  if (latencies.length > 0) {
    session.performanceMetrics.averageLatency = 
      latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
    
    // Calculate percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    session.performanceMetrics.p95Latency = sortedLatencies[p95Index] || 0;
    session.performanceMetrics.p99Latency = sortedLatencies[p99Index] || 0;
  }
}

function updateGlobalMetrics(state: TerminalStoreState) {
  const allSessions = Array.from(state.sessions.values());
  let totalCommands = 0;
  let totalFailedCommands = 0;
  let allLatencies: number[] = [];
  
  allSessions.forEach(session => {
    totalCommands += session.performanceMetrics.totalCommands;
    totalFailedCommands += session.performanceMetrics.failedCommands;
    allLatencies.push(...session.performanceMetrics.commandInjectionLatency);
  });
  
  state.globalPerformanceMetrics.totalCommands = totalCommands;
  state.globalPerformanceMetrics.failedCommands = totalFailedCommands;
  state.globalPerformanceMetrics.successRate = 
    totalCommands > 0 ? ((totalCommands - totalFailedCommands) / totalCommands) * 100 : 100;
  
  if (allLatencies.length > 0) {
    state.globalPerformanceMetrics.averageLatency = 
      allLatencies.reduce((sum, latency) => sum + latency, 0) / allLatencies.length;
    
    const sortedLatencies = [...allLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    state.globalPerformanceMetrics.p95Latency = sortedLatencies[p95Index] || 0;
    state.globalPerformanceMetrics.p99Latency = sortedLatencies[p99Index] || 0;
    state.globalPerformanceMetrics.commandInjectionLatency = allLatencies;
  }
}

// Create and export the store
export const terminalStore = createTerminalStore();

// Derived stores for common use cases
export const activeSessions = derived(
  terminalStore,
  $terminalStore => Array.from($terminalStore.sessions.values()).filter(session => session.uiState.isVisible)
);

export const activeSession = derived(
  terminalStore,
  $terminalStore => $terminalStore.activeSessionId ? $terminalStore.sessions.get($terminalStore.activeSessionId) : null
);

export const commandQueueLength = derived(
  terminalStore,
  $terminalStore => $terminalStore.commandQueue.length
);

export const globalPerformanceStatus = derived(
  terminalStore,
  $terminalStore => ({
    isWithinTarget: $terminalStore.globalPerformanceMetrics.averageLatency <= $terminalStore.performanceConfig.targetLatency,
    metrics: $terminalStore.globalPerformanceMetrics,
    target: $terminalStore.performanceConfig.targetLatency
  })
);

// Performance monitoring debug information
export const terminalStoreDebug = {
  componentPhase: 'mount' as 'mount' | 'update' | 'unmount' | 'error',
  componentName: 'TerminalStore',
  renderTime: 0,
  propsCount: 0,
  stateComplexity: 'medium' as 'low' | 'medium' | 'high'
};