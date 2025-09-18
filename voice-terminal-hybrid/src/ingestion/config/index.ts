/**
 * Configuration and logging for notification ingestion
 */

export { defaultConfig, loadConfig, validateConfig, generateExampleConfig, ENV_VARS } from './default.js';
export { createConsoleLogger, createSilentLogger, createFileLogger, createMultiLogger } from './logger.js';
export type { Logger } from './logger.js';