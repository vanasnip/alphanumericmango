export { TmuxConnectionPool } from './TmuxConnectionPool';
export { CommandBatcher } from './CommandBatcher';
export { SessionCache } from './SessionCache';
export { PerformanceBenchmark, runPerformanceBenchmark } from './PerformanceBenchmark';

export type {
  TmuxConnection,
  ConnectionPoolConfig,
  PoolMetrics
} from './TmuxConnectionPool';

export type {
  BatchCommand,
  BatchConfig,
  BatchMetrics,
  BatchResult
} from './CommandBatcher';

export type {
  CacheEntry,
  CacheConfig,
  CacheStats,
  CacheKey
} from './SessionCache';

export type {
  BenchmarkConfig,
  BenchmarkResult,
  PerformanceReport
} from './PerformanceBenchmark';