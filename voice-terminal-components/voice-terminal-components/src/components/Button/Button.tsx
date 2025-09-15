import React, { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant affecting appearance and elevation */
  variant?: ButtonVariant;
  /** Button size affecting height and padding */
  size?: ButtonSize;
  /** Show loading state with spinner */
  loading?: boolean;
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Make button take full width of container */
  fullWidth?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Button content */
  children?: React.ReactNode;
}

interface SpinnerProps {
  size: ButtonSize;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size, className }) => {
  const sizeMap = {
    sm: 16,
    md: 18,
    lg: 20,
  };

  const spinnerSize = sizeMap[size];

  return (
    <svg
      className={clsx(styles.spinner, className)}
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="32"
        strokeDashoffset="32"
      />
    </svg>
  );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      children,
      disabled,
      type = 'button',
      onKeyDown,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      // Handle Space and Enter key activation
      if ((event.key === ' ' || event.key === 'Enter') && !isDisabled) {
        event.preventDefault();
        if (event.key === ' ') {
          // Trigger click for Space key
          event.currentTarget.click();
        }
      }
      onKeyDown?.(event);
    };

    const buttonClasses = clsx(
      styles.button,
      styles[variant],
      styles[size],
      {
        [styles.loading]: loading,
        [styles.disabled]: isDisabled,
        [styles.fullWidth]: fullWidth,
        [styles.hasLeftIcon]: leftIcon && !loading,
        [styles.hasRightIcon]: rightIcon && !loading,
        [styles.iconOnly]: !children && (leftIcon || rightIcon) && !loading,
      },
      className
    );

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={isDisabled}
        onKeyDown={handleKeyDown}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...rest}
      >
        {loading && <Spinner size={size} className={styles.loadingSpinner} />}
        {leftIcon && !loading && (
          <span className={styles.leftIcon} aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children && (
          <span className={styles.content}>
            {children}
          </span>
        )}
        {rightIcon && !loading && (
          <span className={styles.rightIcon} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';