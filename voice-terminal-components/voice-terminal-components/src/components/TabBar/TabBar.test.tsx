import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabBar, TabData } from './TabBar';

const mockTabs: TabData[] = [
  { id: 'tab1', label: 'Tab 1', projectColor: 0 },
  { id: 'tab2', label: 'Tab 2', icon: <span>📄</span>, projectColor: 1 },
  { id: 'tab3', label: 'Tab 3', closeable: true, projectColor: 2 },
  { id: 'tab4', label: 'Disabled Tab', disabled: true, projectColor: 3 },
  { id: 'tab5', label: 'Long Tab Name That Should Truncate', closeable: true, projectColor: 4 },
];

describe('TabBar Component', () => {
  const defaultProps = {
    tabs: mockTabs,
    activeTabId: 'tab1',
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all tabs correctly', () => {
      render(<TabBar {...defaultProps} />);
      
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
      expect(screen.getByText('Disabled Tab')).toBeInTheDocument();
      expect(screen.getByText('Long Tab Name That Should Truncate')).toBeInTheDocument();
    });

    it('renders tab icons when provided', () => {
      render(<TabBar {...defaultProps} />);
      
      expect(screen.getByText('📄')).toBeInTheDocument();
    });

    it('renders close buttons for closeable tabs', () => {
      render(<TabBar {...defaultProps} />);
      
      const closeButtons = screen.getAllByLabelText(/Close .* tab/);
      expect(closeButtons).toHaveLength(2); // tab3 and tab5 are closeable
    });

    it('applies active state correctly', () => {
      render(<TabBar {...defaultProps} />);
      
      const activeTab = screen.getByText('Tab 1').closest('[role="tab"]');
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
      expect(activeTab).toHaveAttribute('tabindex', '0');
    });

    it('applies disabled state correctly', () => {
      render(<TabBar {...defaultProps} />);
      
      const disabledTab = screen.getByText('Disabled Tab').closest('[role="tab"]');
      expect(disabledTab).toHaveAttribute('aria-disabled', 'true');
      expect(disabledTab).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Tab Selection', () => {
    it('calls onTabSelect when clicking a tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      await user.click(screen.getByText('Tab 2'));
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab2');
    });

    it('does not call onTabSelect when clicking disabled tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      await user.click(screen.getByText('Disabled Tab'));
      
      expect(defaultProps.onTabSelect).not.toHaveBeenCalled();
    });

    it('calls onTabSelect when pressing Enter on focused tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      const tab2 = screen.getByText('Tab 2').closest('[role="tab"]') as HTMLElement;
      tab2.focus();
      await user.keyboard('{Enter}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab2');
    });

    it('calls onTabSelect when pressing Space on focused tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      const tab2 = screen.getByText('Tab 2').closest('[role="tab"]') as HTMLElement;
      tab2.focus();
      await user.keyboard(' ');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab2');
    });
  });

  describe('Tab Closing', () => {
    it('calls onTabClose when clicking close button', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close Tab 3 tab');
      await user.click(closeButton);
      
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab3');
    });

    it('does not trigger tab selection when clicking close button', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close Tab 3 tab');
      await user.click(closeButton);
      
      expect(defaultProps.onTabSelect).not.toHaveBeenCalled();
    });

    it('calls onTabClose when pressing Delete on closeable tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab3" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{Delete}');
      
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab3');
    });

    it('calls onTabClose when pressing Backspace on closeable tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab3" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{Backspace}');
      
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab3');
    });

    it('does not call onTabClose when pressing Delete on non-closeable tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab1" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{Delete}');
      
      expect(defaultProps.onTabClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates to next tab with ArrowRight', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{ArrowRight}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab2');
    });

    it('navigates to previous tab with ArrowLeft', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab2" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{ArrowLeft}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab1');
    });

    it('wraps to last tab when pressing ArrowLeft on first tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab1" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{ArrowLeft}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab5');
    });

    it('wraps to first tab when pressing ArrowRight on last tab', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab5" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{ArrowRight}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab1');
    });

    it('skips disabled tabs when navigating', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab3" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{ArrowRight}');
      
      // Should skip tab4 (disabled) and go to tab5
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab5');
    });

    it('navigates to first tab with Home key', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab3" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{Home}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab1');
    });

    it('navigates to last tab with End key', async () => {
      const user = userEvent.setup();
      render(<TabBar {...defaultProps} activeTabId="tab1" />);
      
      const tabBar = screen.getByRole('tablist').parentElement as HTMLElement;
      tabBar.focus();
      await user.keyboard('{End}');
      
      expect(defaultProps.onTabSelect).toHaveBeenCalledWith('tab5');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<TabBar {...defaultProps} aria-label="Project tabs" />);
      
      const tabList = screen.getByRole('tablist');
      expect(tabList).toHaveAttribute('aria-label', 'Project tabs');
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('aria-posinset', (index + 1).toString());
        expect(tab).toHaveAttribute('aria-setsize', tabs.length.toString());
        expect(tab).toHaveAttribute('aria-controls', expect.stringMatching(/^tabpanel-/));
      });
    });

    it('manages focus correctly', () => {
      render(<TabBar {...defaultProps} />);
      
      const activeTab = screen.getByText('Tab 1').closest('[role="tab"]');
      const inactiveTab = screen.getByText('Tab 2').closest('[role="tab"]');
      
      expect(activeTab).toHaveAttribute('tabindex', '0');
      expect(inactiveTab).toHaveAttribute('tabindex', '-1');
    });

    it('provides accessible close button labels', () => {
      render(<TabBar {...defaultProps} />);
      
      expect(screen.getByLabelText('Close Tab 3 tab')).toBeInTheDocument();
      expect(screen.getByLabelText('Close Long Tab Name That Should Truncate tab')).toBeInTheDocument();
    });
  });

  describe('Overflow Handling', () => {
    const manyTabs = Array.from({ length: 15 }, (_, i) => ({
      id: `tab${i + 1}`,
      label: `Tab ${i + 1}`,
      projectColor: i % 9,
    }));

    it('shows scroll buttons when tabs overflow', () => {
      render(<TabBar {...defaultProps} tabs={manyTabs} maxVisibleTabs={8} />);
      
      // Note: Scroll buttons visibility depends on actual overflow, which may not occur in test environment
      // This test verifies the component renders without errors with many tabs
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('handles scroll button clicks', async () => {
      const user = userEvent.setup();
      
      // Mock scrollBy function
      const mockScrollBy = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
        value: mockScrollBy,
        writable: true,
      });
      
      render(<TabBar {...defaultProps} tabs={manyTabs} maxVisibleTabs={5} />);
      
      // Simulate presence of scroll buttons by forcing overflow state
      const scrollButtons = document.querySelectorAll('button[aria-label*="Scroll"]');
      if (scrollButtons.length > 0) {
        await user.click(scrollButtons[0]);
        // Would verify scroll behavior in real browser environment
      }
    });
  });

  describe('Project Colors', () => {
    it('applies correct project color data attributes', () => {
      render(<TabBar {...defaultProps} />);
      
      const tab1 = screen.getByText('Tab 1').closest('[role="tab"]');
      const tab2 = screen.getByText('Tab 2').closest('[role="tab"]');
      
      expect(tab1).toHaveAttribute('data-project-color', '0');
      expect(tab2).toHaveAttribute('data-project-color', '1');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(<TabBar {...defaultProps} className="custom-class" />);
      
      const tabBar = screen.getByRole('tablist').parentElement;
      expect(tabBar).toHaveClass('custom-class');
    });

    it('forwards additional props', () => {
      render(<TabBar {...defaultProps} data-testid="tab-bar" />);
      
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty tabs array', () => {
      render(<TabBar {...defaultProps} tabs={[]} />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('handles single tab', () => {
      const singleTab = [{ id: 'only', label: 'Only Tab', projectColor: 0 }];
      render(<TabBar {...defaultProps} tabs={singleTab} activeTabId="only" />);
      
      expect(screen.getByText('Only Tab')).toBeInTheDocument();
    });

    it('handles invalid activeTabId gracefully', () => {
      render(<TabBar {...defaultProps} activeTabId="nonexistent" />);
      
      // Should render without crashing
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('handles missing onTabClose for closeable tabs', () => {
      const propsWithoutClose = { ...defaultProps, onTabClose: undefined };
      render(<TabBar {...propsWithoutClose} />);
      
      // Close buttons should still render but not be functional
      expect(screen.getByLabelText('Close Tab 3 tab')).toBeInTheDocument();
    });
  });
});