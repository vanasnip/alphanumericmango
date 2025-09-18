/**
 * Notification transformers for converting various formats to unified schema
 */

export { BaseTransformer, TransformerRegistry } from './base.js';
export { GitHubTransformer } from './github.js';
export { EmailTransformer } from './email.js';
export { GenericTransformer } from './generic.js';

import { TransformerRegistry } from './base.js';
import { GitHubTransformer } from './github.js';
import { EmailTransformer } from './email.js';
import { GenericTransformer } from './generic.js';

/**
 * Create and configure the default transformer registry
 */
export function createDefaultTransformerRegistry(): TransformerRegistry {
  const registry = new TransformerRegistry();

  // Register transformers in order of priority
  registry.register(new GitHubTransformer());
  registry.register(new EmailTransformer());
  registry.register(new GenericTransformer()); // Always register generic last as fallback

  return registry;
}