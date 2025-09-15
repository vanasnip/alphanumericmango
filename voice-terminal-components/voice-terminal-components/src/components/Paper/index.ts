/**
 * Paper Component
 * 
 * A neumorphic container component with elevation variants for the Voice Terminal design system.
 * 
 * @example
 * ```tsx
 * import { Paper } from '@voice-terminal/components';
 * 
 * // Basic usage
 * <Paper>Content</Paper>
 * 
 * // With custom props
 * <Paper elevation="recessed" padding="lg" as="section" interactive>
 *   Interactive content
 * </Paper>
 * ```
 */

export { default as Paper } from './Paper';
export type { PaperProps, PaperOwnProps, PaperComponent } from './Paper';

// Re-export related types for convenience
export type { Elevation, Size } from '../../types/theme';