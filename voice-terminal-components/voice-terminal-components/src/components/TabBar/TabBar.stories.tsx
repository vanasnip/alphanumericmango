import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { TabBar, TabData } from './TabBar';

const meta: Meta<typeof TabBar> = {
  title: 'Components/TabBar',
  component: TabBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The TabBar component provides tab navigation with seamless connection to content areas. 
It supports keyboard navigation, tab closing, icons, and project color indicators.

## Features
- Seamless visual connection to content (no gaps)
- Keyboard navigation with arrow keys
- Optional close buttons on tabs
- Icon support
- Overflow scrolling for many tabs
- Project color indicators for active tabs
- Full accessibility support

## Design Specifications
- Height: 40px
- Active tab background matches content area
- Active tab indicator: 2-3px bottom border in project color
- Border radius: 8px 8px 0 0 (top only for seamless connection)
- Smooth transitions between states
        `,
      },
    },
  },
  argTypes: {
    tabs: {
      description: 'Array of tab data objects',
      control: { type: 'object' },
    },
    activeTabId: {
      description: 'ID of currently active tab',
      control: { type: 'text' },
    },
    onTabSelect: {
      description: 'Callback when tab is selected',
      action: 'tab-selected',
    },
    onTabClose: {
      description: 'Callback when tab is closed',
      action: 'tab-closed',
    },
    maxVisibleTabs: {
      description: 'Maximum number of visible tabs before scrolling',
      control: { type: 'number', min: 3, max: 15 },
    },
    'aria-label': {
      description: 'ARIA label for the tab list',
      control: { type: 'text' },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TabBar>;

// Sample icons for stories
const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-5L6 2H4z" />
  </svg>
);

const CodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5.854 4.854a.5.5 0 10-.708-.708l-3.5 3.5a.5.5 0 000 .708l3.5 3.5a.5.5 0 00.708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 01.708-.708l3.5 3.5a.5.5 0 010 .708l-3.5 3.5a.5.5 0 01-.708-.708L13.293 8l-3.147-3.146z" />
  </svg>
);

const TerminalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 3a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V3zm2-1a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V3a1 1 0 00-1-1H2z" />
    <path d="M3.146 5.146a.5.5 0 01.708 0L5.707 7l-1.853 1.854a.5.5 0 01-.708-.708L4.293 7 3.146 5.854a.5.5 0 010-.708zM7 9.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" />
  </svg>
);

// Interactive story template
const InteractiveTemplate = (args: any) => {
  const [activeTabId, setActiveTabId] = useState(args.activeTabId);
  const [tabs, setTabs] = useState(args.tabs);

  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    args.onTabSelect?.(tabId);
  };

  const handleTabClose = (tabId: string) => {
    setTabs((prevTabs: TabData[]) => prevTabs.filter(tab => tab.id !== tabId));
    args.onTabClose?.(tabId);
    
    // Select a different tab if the closed tab was active
    if (tabId === activeTabId) {
      const remainingTabs = tabs.filter(tab => tab.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[0].id);
      }
    }
  };

  return (
    <div style={{ background: 'var(--bg-primary, #EFF2F9)', padding: '24px', borderRadius: '8px' }}>
      <TabBar
        {...args}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
      />
      <div 
        style={{ 
          background: 'var(--bg-primary, #EFF2F9)', 
          padding: '24px', 
          minHeight: '200px',
          borderRadius: '0 0 8px 8px',
          border: '1px solid var(--bg-secondary, #E4EBF1)',
          borderTop: 'none'
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary, #6E7F8D)' }}>
          Content for: {tabs.find(tab => tab.id === activeTabId)?.label || 'No active tab'}
        </h3>
        <p style={{ color: 'var(--text-secondary, #B5BFC6)', margin: 0 }}>
          This content area demonstrates the seamless connection with the TabBar. 
          Notice how there's no gap between the active tab and this content area.
        </p>
      </div>
    </div>
  );
};

// Basic tabs data
const basicTabs: TabData[] = [
  { id: 'home', label: 'Home', projectColor: 0 },
  { id: 'about', label: 'About', projectColor: 1 },
  { id: 'contact', label: 'Contact', projectColor: 2 },
];

// Tabs with icons and various features
const featureTabs: TabData[] = [
  { id: 'file1', label: 'README.md', icon: <FileIcon />, projectColor: 0 },
  { id: 'file2', label: 'index.tsx', icon: <CodeIcon />, closeable: true, projectColor: 1 },
  { id: 'terminal', label: 'Terminal', icon: <TerminalIcon />, closeable: true, projectColor: 2 },
  { id: 'disabled', label: 'Disabled', disabled: true, projectColor: 3 },
];

// Many tabs for overflow testing
const manyTabs: TabData[] = Array.from({ length: 12 }, (_, i) => ({
  id: `tab${i + 1}`,
  label: `Tab ${i + 1}`,
  icon: i % 3 === 0 ? <FileIcon /> : i % 3 === 1 ? <CodeIcon /> : <TerminalIcon />,
  closeable: i > 2,
  projectColor: i % 9,
}));

export const Default: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: basicTabs,
    activeTabId: 'home',
    'aria-label': 'Main navigation tabs',
  },
};

export const WithIcons: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: featureTabs,
    activeTabId: 'file1',
    'aria-label': 'File tabs',
  },
};

export const WithCloseButtons: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: featureTabs,
    activeTabId: 'file2',
    'aria-label': 'Closeable file tabs',
  },
};

export const Overflow: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: manyTabs,
    activeTabId: 'tab1',
    maxVisibleTabs: 6,
    'aria-label': 'Many tabs with overflow scrolling',
  },
  parameters: {
    docs: {
      description: {
        story: 'When there are more tabs than can fit, the component provides horizontal scrolling with visual indicators.',
      },
    },
  },
};

export const LongLabels: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: [
      { id: 'short', label: 'Short', projectColor: 0 },
      { id: 'medium', label: 'Medium Length Tab', projectColor: 1 },
      { id: 'long', label: 'Very Long Tab Name That Will Truncate', closeable: true, projectColor: 2 },
      { id: 'extreme', label: 'Extremely Long Tab Name That Definitely Should Truncate With Ellipsis', closeable: true, projectColor: 3 },
    ],
    activeTabId: 'long',
    'aria-label': 'Tabs with various label lengths',
  },
  parameters: {
    docs: {
      description: {
        story: 'Long tab labels are automatically truncated with ellipsis to maintain consistent tab widths.',
      },
    },
  },
};

export const ProjectColors: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: [
      { id: 'yellow', label: 'Yellow', projectColor: 0 },
      { id: 'blue', label: 'Blue', projectColor: 1 },
      { id: 'green', label: 'Green', projectColor: 2 },
      { id: 'cyan', label: 'Cyan', projectColor: 3 },
      { id: 'purple', label: 'Purple', projectColor: 4 },
      { id: 'brown', label: 'Brown', projectColor: 5 },
      { id: 'red', label: 'Red', projectColor: 6 },
      { id: 'pink', label: 'Pink', projectColor: 7 },
      { id: 'indigo', label: 'Indigo', projectColor: 8 },
    ],
    activeTabId: 'blue',
    'aria-label': 'Tabs showing all project colors',
  },
  parameters: {
    docs: {
      description: {
        story: 'Each tab can have a project color that appears as a bottom border indicator when the tab is active.',
      },
    },
  },
};

export const SingleTab: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: [{ id: 'only', label: 'Only Tab', icon: <FileIcon />, projectColor: 0 }],
    activeTabId: 'only',
    'aria-label': 'Single tab example',
  },
};

export const EmptyState: Story = {
  args: {
    tabs: [],
    activeTabId: '',
    'aria-label': 'Empty tab bar',
  },
  parameters: {
    docs: {
      description: {
        story: 'The TabBar gracefully handles an empty tabs array.',
      },
    },
  },
};

// Keyboard navigation demo (static story for documentation)
export const KeyboardNavigation: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: featureTabs,
    activeTabId: 'file1',
    'aria-label': 'Keyboard navigation demo',
  },
  parameters: {
    docs: {
      description: {
        story: `
### Keyboard Navigation

The TabBar supports full keyboard navigation:

- **Arrow Left/Right**: Navigate between tabs
- **Home/End**: Jump to first/last tab
- **Enter/Space**: Activate focused tab
- **Delete/Backspace**: Close active tab (if closeable)

Try focusing the TabBar and using keyboard navigation!
        `,
      },
    },
  },
};

// Accessibility showcase
export const Accessibility: Story = {
  render: InteractiveTemplate,
  args: {
    tabs: featureTabs,
    activeTabId: 'file1',
    'aria-label': 'Accessibility demonstration',
  },
  parameters: {
    docs: {
      description: {
        story: `
### Accessibility Features

- Full ARIA tab pattern implementation
- Keyboard navigation support
- Focus management
- Screen reader friendly labels
- High contrast mode support
- Reduced motion support
        `,
      },
    },
  },
};