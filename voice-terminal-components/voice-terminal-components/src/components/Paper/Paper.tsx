import React, { forwardRef } from 'react';
import clsx from 'clsx';
import type { Elevation, Size } from '../../types/theme';
import styles from './Paper.module.css';

// Polymorphic component type helpers
type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicComponentProp<
  C extends React.ElementType,
  Props = {}
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

type PolymorphicRef<C extends React.ElementType> =
  React.ComponentPropsWithRef<C>['ref'];

// Paper component specific props
export interface PaperOwnProps {
  /**
   * The elevation variant that determines the neumorphic style
   * @default 'raised'
   */
  elevation?: Elevation;
  
  /**
   * The padding size applied to all sides
   * @default 'md'
   */
  padding?: Size;
  
  /**
   * Custom CSS class name
   */
  className?: string;
  
  /**
   * Whether the component should have interactive hover effects
   * @default false
   */
  interactive?: boolean;
  
  /**
   * ARIA role for accessibility
   * @default 'generic'
   */
  role?: string;
}

// Complete polymorphic component type
export type PaperProps<C extends React.ElementType = 'div'> =
  PolymorphicComponentProp<C, PaperOwnProps>;

// Component type with generic constraint
export type PaperComponent = <C extends React.ElementType = 'div'>(
  props: PaperProps<C> & { ref?: PolymorphicRef<C> }
) => React.ReactElement | null;

/**
 * Paper - A neumorphic container component with elevation variants
 * 
 * Features:
 * - Multiple elevation variants (raised, recessed, flat)
 * - Configurable padding sizes (xs, sm, md, lg, xl, xxl)
 * - Theme-aware styling (light/dark modes)
 * - Polymorphic 'as' prop for semantic HTML
 * - Full accessibility support
 * - Optional interactive hover effects
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <Paper>Content goes here</Paper>
 * 
 * // With props
 * <Paper 
 *   elevation="recessed" 
 *   padding="lg" 
 *   as="section" 
 *   interactive
 * >
 *   Interactive content
 * </Paper>
 * ```
 */
export const Paper: PaperComponent = forwardRef(
  <C extends React.ElementType = 'div'>(
    {
      as,
      elevation = 'raised',
      padding = 'md',
      className,
      interactive = false,
      role = 'generic',
      children,
      ...restProps
    }: PaperProps<C>,
    ref?: PolymorphicRef<C>
  ) => {
    const Component = as || 'div';
    
    const paperClasses = clsx(
      styles.paper,
      styles[`elevation-${elevation}`],
      styles[`padding-${padding}`],
      {
        [styles.interactive]: interactive,
      },
      className
    );
    
    return (
      <Component
        ref={ref}
        className={paperClasses}
        role={role}
        {...restProps}
      >
        {children}
      </Component>
    );
  }
);

Paper.displayName = 'Paper';

export default Paper;