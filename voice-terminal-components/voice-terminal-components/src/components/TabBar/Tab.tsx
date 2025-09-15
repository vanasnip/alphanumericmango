import React, { forwardRef } from 'react';
import clsx from 'clsx';
import styles from './TabBar.module.css';

export interface TabProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique identifier for the tab */
  id: string;
  /** Tab label text */
  label: string;
  /** Optional icon to display in tab */
  icon?: React.ReactNode;
  /** Whether tab is currently active */
  active?: boolean;
  /** Whether tab can be closed */
  closeable?: boolean;
  /** Whether tab is disabled */
  disabled?: boolean;
  /** Project color index (0-8) for active indicator */
  projectColor?: number;
  /** Callback when tab is selected */
  onSelect?: () => void;
  /** Callback when tab is closed */
  onClose?: () => void;
  /** Tab index for focus management */
  tabIndex?: number;
  /** ARIA position in set */
  'aria-posinset'?: number;
  /** ARIA set size */
  'aria-setsize'?: number;
}

export const Tab = forwardRef<HTMLDivElement, TabProps>(
  (
    {
      id,
      label,
      icon,
      active = false,
      closeable = false,
      disabled = false,
      projectColor = 0,
      onSelect,
      onClose,
      className,
      tabIndex = -1,
      onClick,
      onKeyDown,
      'aria-posinset': ariaPosinset,
      'aria-setsize': ariaSetsize,
      ...rest
    },
    ref
  ) => {
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onSelect?.();
      onClick?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) {
        onKeyDown?.(event);
        return;
      }

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect?.();
          break;
        case 'Delete':
        case 'Backspace':
          if (closeable && onClose) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          break;
        default:
          break;
      }
      onKeyDown?.(event);
    };

    const handleCloseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onClose?.();
    };

    const handleCloseKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
      }
    };

    const tabClasses = clsx(
      styles.tab,
      {
        [styles.tabActive]: active,
        [styles.tabDisabled]: disabled,
        [styles.tabCloseable]: closeable,
      },
      className
    );

    return (
      <div
        ref={ref}
        className={tabClasses}
        role="tab"
        aria-selected={active}
        aria-disabled={disabled}
        aria-controls={`tabpanel-${id}`}
        aria-posinset={ariaPosinset}
        aria-setsize={ariaSetsize}
        tabIndex={tabIndex}
        data-tab-id={id}
        data-project-color={projectColor}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div className={styles.tabContent}>
          {icon && (
            <span className={styles.tabIcon} aria-hidden="true">
              {icon}
            </span>
          )}
          <span className={styles.tabLabel}>{label}</span>
        </div>

        {closeable && (
          <button
            className={styles.tabCloseButton}
            onClick={handleCloseClick}
            onKeyDown={handleCloseKeyDown}
            aria-label={`Close ${label} tab`}
            tabIndex={-1}
            type="button"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 4.586L9.536 1.05a1 1 0 011.414 1.414L7.414 6l3.536 3.536a1 1 0 01-1.414 1.414L6 7.414 2.464 10.95a1 1 0 01-1.414-1.414L4.586 6 1.05 2.464a1 1 0 011.414-1.414L6 4.586z" />
            </svg>
          </button>
        )}

        {active && (
          <div 
            className={styles.tabActiveIndicator}
            data-project-color={projectColor}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }
);

Tab.displayName = 'Tab';