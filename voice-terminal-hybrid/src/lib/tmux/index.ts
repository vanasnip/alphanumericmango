export { TmuxIntegration } from './TmuxIntegration';
export { TmuxSessionManager } from './TmuxSessionManager';
export { TmuxBenchmark, runBenchmark } from './benchmark';

// Performance Optimization Components
export { 
  TmuxConnectionPool, 
  CommandBatcher, 
  SessionCache,
  PerformanceBenchmark,
  runPerformanceBenchmark 
} from './performance';
export type {
  TmuxSession,
  TmuxWindow,
  TmuxPane,
  CommandExecution,
  PerformanceMetrics,
  TmuxConfig,
  TmuxEvent,
  TmuxEventType
} from './types';

// Performance optimization types
export type {
  TmuxConnection,
  ConnectionPoolConfig,
  PoolMetrics,
  BatchCommand,
  BatchConfig,
  BatchMetrics,
  BatchResult,
  CacheEntry,
  CacheConfig,
  CacheStats,
  CacheKey,
  BenchmarkConfig,
  BenchmarkResult,
  PerformanceReport
} from './performance';