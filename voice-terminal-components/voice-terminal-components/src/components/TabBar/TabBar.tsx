import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Tab, TabProps } from './Tab';
import styles from './TabBar.module.css';

export interface TabData {
  /** Unique identifier for the tab */
  id: string;
  /** Tab label text */
  label: string;
  /** Optional icon to display in tab */
  icon?: React.ReactNode;
  /** Whether tab can be closed */
  closeable?: boolean;
  /** Whether tab is disabled */
  disabled?: boolean;
  /** Project color index (0-8) for active indicator */
  projectColor?: number;
}

export interface TabBarProps {
  /** Array of tab data objects */
  tabs: TabData[];
  /** ID of currently active tab */
  activeTabId: string;
  /** Callback when tab is selected */
  onTabSelect: (tabId: string) => void;
  /** Callback when tab is closed */
  onTabClose?: (tabId: string) => void;
  /** Maximum number of visible tabs before scrolling */
  maxVisibleTabs?: number;
  /** Additional CSS class names */
  className?: string;
  /** ARIA label for the tab list */
  'aria-label'?: string;
}

export const TabBar = forwardRef<HTMLDivElement, TabBarProps>(
  (
    {
      tabs,
      activeTabId,
      onTabSelect,
      onTabClose,
      maxVisibleTabs = 8,
      className,
      'aria-label': ariaLabel = 'Tab navigation',
      ...rest
    },
    ref
  ) => {
    const tabListRef = useRef<HTMLDivElement>(null);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Check scroll capabilities
    const updateScrollState = useCallback(() => {
      const container = tabListRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
      setScrollPosition(scrollLeft);
    }, []);

    useEffect(() => {
      updateScrollState();
      const container = tabListRef.current;
      if (container) {
        container.addEventListener('scroll', updateScrollState);
        return () => container.removeEventListener('scroll', updateScrollState);
      }
    }, [updateScrollState, tabs]);

    // Scroll active tab into view
    useEffect(() => {
      const container = tabListRef.current;
      if (!container) return;

      const activeTabElement = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement;
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }, [activeTabId]);

    // Keyboard navigation
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      let nextIndex = currentIndex;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          event.preventDefault();
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = tabs.length - 1;
          break;
        case 'Delete':
        case 'Backspace':
          if (onTabClose && tabs[currentIndex]?.closeable) {
            event.preventDefault();
            onTabClose(activeTabId);
          }
          break;
        default:
          return;
      }

      // Skip disabled tabs
      while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
        if (event.key === 'ArrowLeft' || event.key === 'Home') {
          nextIndex = nextIndex > 0 ? nextIndex - 1 : tabs.length - 1;
        } else {
          nextIndex = nextIndex < tabs.length - 1 ? nextIndex + 1 : 0;
        }
      }

      if (nextIndex !== currentIndex && !tabs[nextIndex]?.disabled) {
        onTabSelect(tabs[nextIndex].id);
      }
    };

    const scrollLeft = () => {
      const container = tabListRef.current;
      if (container) {
        container.scrollBy({ left: -200, behavior: 'smooth' });
      }
    };

    const scrollRight = () => {
      const container = tabListRef.current;
      if (container) {
        container.scrollBy({ left: 200, behavior: 'smooth' });
      }
    };

    const hasOverflow = tabs.length > maxVisibleTabs;

    return (
      <div
        ref={ref}
        className={clsx(styles.tabBar, className)}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {hasOverflow && canScrollLeft && (
          <button
            className={clsx(styles.scrollButton, styles.scrollLeft)}
            onClick={scrollLeft}
            aria-label="Scroll tabs left"
            tabIndex={-1}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 12l-4-4 4-4v8z" />
            </svg>
          </button>
        )}

        <div
          ref={tabListRef}
          className={clsx(styles.tabList, {
            [styles.hasOverflow]: hasOverflow
          })}
          role="tablist"
          aria-label={ariaLabel}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              active={tab.id === activeTabId}
              closeable={tab.closeable}
              disabled={tab.disabled}
              projectColor={tab.projectColor}
              onSelect={() => onTabSelect(tab.id)}
              onClose={onTabClose ? () => onTabClose(tab.id) : undefined}
              tabIndex={tab.id === activeTabId ? 0 : -1}
              aria-posinset={index + 1}
              aria-setsize={tabs.length}
            />
          ))}
        </div>

        {hasOverflow && canScrollRight && (
          <button
            className={clsx(styles.scrollButton, styles.scrollRight)}
            onClick={scrollRight}
            aria-label="Scroll tabs right"
            tabIndex={-1}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l4 4-4 4V4z" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

TabBar.displayName = 'TabBar';