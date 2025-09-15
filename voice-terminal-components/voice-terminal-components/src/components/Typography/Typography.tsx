import React from 'react';
import clsx from 'clsx';
import styles from './Typography.module.css';

// Define the typography variants
export type TypographyVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'h4' 
  | 'h5' 
  | 'h6' 
  | 'body' 
  | 'caption' 
  | 'label';

// Define font weights
export type FontWeight = 'light' | 'regular' | 'medium' | 'semibold';

// Define font families
export type FontFamily = 'sans' | 'mono';

// Define text colors
export type TextColor = 'primary' | 'secondary' | 'bright';

// Polymorphic component props
type PolymorphicComponentProps<T extends React.ElementType> = {
  as?: T;
  variant?: TypographyVariant;
  weight?: FontWeight;
  family?: FontFamily;
  color?: TextColor;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'variant' | 'weight' | 'family' | 'color' | 'className' | 'children'>;

// Default element mapping for each variant
const defaultElementMap: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  body: 'p',
  caption: 'span',
  label: 'label',
};

// Typography component with polymorphic support
export const Typography = <T extends React.ElementType = 'p'>({
  as,
  variant = 'body',
  weight = 'regular',
  family = 'sans',
  color = 'primary',
  className,
  children,
  ...props
}: PolymorphicComponentProps<T>) => {
  // Determine the element to render
  const Element = as || defaultElementMap[variant];
  
  // Build the CSS class names
  const classNames = clsx(
    styles.typography,
    styles[`variant-${variant}`],
    styles[`weight-${weight}`],
    styles[`family-${family}`],
    styles[`color-${color}`],
    className
  );

  return (
    <Element className={classNames} {...props}>
      {children}
    </Element>
  );
};

Typography.displayName = 'Typography';

export default Typography;