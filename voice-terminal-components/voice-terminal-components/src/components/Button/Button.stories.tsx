import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Button } from './Button';
import React from 'react';

// Mock icons for stories
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A neumorphic button component with multiple variants, sizes, and states. Built with accessibility in mind and following the Paper theme design system.

## Features
- **Variants**: Primary (raised), Secondary (flat), Ghost (transparent)
- **Sizes**: Small (32px), Medium (40px), Large (48px)
- **States**: Loading with spinner, Disabled
- **Icons**: Left and right icon support
- **Accessibility**: Full keyboard navigation and ARIA support
- **Theme**: Automatic light/dark mode support
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
      description: 'Button visual variant affecting elevation and appearance',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size affecting height and padding',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading state with animated spinner',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable button interaction',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Make button take full width of container',
    },
    leftIcon: {
      control: false,
      description: 'Icon to display on the left side',
    },
    rightIcon: {
      control: false,
      description: 'Icon to display on the right side',
    },
    children: {
      control: 'text',
      description: 'Button text content',
    },
    onClick: {
      action: 'clicked',
      description: 'Callback fired when button is clicked',
    },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic variants
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Buttons come in three sizes: small (32px), medium (40px), and large (48px) height.',
      },
    },
  },
};

// All variants comparison
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Primary has raised elevation, Secondary has flat elevation, and Ghost is transparent with hover effects.',
      },
    },
  },
};

// States
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading state shows an animated spinner and prevents interaction.',
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled state reduces opacity and prevents interaction.',
      },
    },
  },
};

// Icons
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <PlayIcon />,
    children: 'Play Video',
  },
  parameters: {
    docs: {
      description: {
        story: 'Buttons can include icons on the left side of the text.',
      },
    },
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: <DownloadIcon />,
    children: 'Download',
  },
  parameters: {
    docs: {
      description: {
        story: 'Buttons can include icons on the right side of the text.',
      },
    },
  },
};

export const WithBothIcons: Story = {
  args: {
    leftIcon: <PlusIcon />,
    rightIcon: <DownloadIcon />,
    children: 'Add & Download',
  },
  parameters: {
    docs: {
      description: {
        story: 'Buttons can include icons on both sides of the text.',
      },
    },
  },
};

export const IconOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Button size="sm" leftIcon={<PlusIcon />} aria-label="Add item" />
      <Button size="md" leftIcon={<PlayIcon />} aria-label="Play" />
      <Button size="lg" leftIcon={<DownloadIcon />} aria-label="Download" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Icon-only buttons automatically adjust to square dimensions. Remember to include aria-label for accessibility.',
      },
    },
  },
};

// Layout
export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Full-width buttons expand to fill their container.',
      },
    },
  },
};

// Interactive states demonstration
export const InteractiveStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(3, 1fr)', width: '600px' }}>
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500 }}>Normal</h4>
        <Button variant="primary">Primary</Button>
      </div>
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500 }}>Loading</h4>
        <Button variant="primary" loading>Primary</Button>
      </div>
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500 }}>Disabled</h4>
        <Button variant="primary" disabled>Primary</Button>
      </div>
      <div>
        <Button variant="secondary">Secondary</Button>
      </div>
      <div>
        <Button variant="secondary" loading>Secondary</Button>
      </div>
      <div>
        <Button variant="secondary" disabled>Secondary</Button>
      </div>
      <div>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div>
        <Button variant="ghost" loading>Ghost</Button>
      </div>
      <div>
        <Button variant="ghost" disabled>Ghost</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive overview of all button variants in different states.',
      },
    },
  },
};

// Real-world examples
export const FormActions: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
      <Button variant="ghost">Cancel</Button>
      <Button variant="secondary">Save Draft</Button>
      <Button variant="primary">Publish</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Typical form action buttons with appropriate hierarchy.',
      },
    },
  },
};

export const ToolbarActions: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', background: '#f5f5f5', borderRadius: '8px' }}>
      <Button size="sm" variant="ghost" leftIcon={<PlusIcon />} aria-label="Add" />
      <Button size="sm" variant="ghost" leftIcon={<PlayIcon />} aria-label="Play" />
      <Button size="sm" variant="ghost" leftIcon={<DownloadIcon />} aria-label="Download" />
      <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 4px' }} />
      <Button size="sm" variant="secondary">Export</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Toolbar with icon buttons and action buttons.',
      },
    },
  },
};

// Accessibility demo
export const AccessibilityDemo: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '300px' }}>
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500 }}>Keyboard Navigation</h4>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
          Tab to focus, Space or Enter to activate
        </p>
        <Button>Focus me and press Space</Button>
      </div>
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500 }}>Screen Reader Support</h4>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
          Icons are hidden from screen readers, states are announced
        </p>
        <Button leftIcon={<PlayIcon />} aria-label="Play the current song">
          Play Song
        </Button>
      </div>
      
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500 }}>Loading State</h4>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
          aria-busy="true" is announced to screen readers
        </p>
        <Button loading>Processing...</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Accessibility features include keyboard navigation, ARIA attributes, and screen reader support.',
      },
    },
  },
};