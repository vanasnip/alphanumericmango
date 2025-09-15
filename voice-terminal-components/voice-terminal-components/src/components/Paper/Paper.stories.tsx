import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import Paper from './Paper';
import type { PaperProps } from './Paper';

// Storybook meta configuration
const meta: Meta<typeof Paper> = {
  title: 'Components/Paper',
  component: Paper,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A neumorphic container component that provides visual elevation and structure to content.

## Features
- **Elevation variants**: raised, recessed, flat
- **Spacing options**: xs, sm, md, lg, xl, xxl padding
- **Theme-aware**: Adapts to light/dark themes automatically
- **Polymorphic**: Use any HTML element via the 'as' prop
- **Accessible**: Full ARIA support and keyboard navigation
- **Interactive**: Optional hover effects for clickable elements

## Design System
The Paper component follows the Voice Terminal design system with neumorphic styling that creates depth through shadows and subtle color variations.
        `,
      },
    },
  },
  argTypes: {
    elevation: {
      control: { type: 'select' },
      options: ['raised', 'recessed', 'flat'],
      description: 'Visual elevation style',
    },
    padding: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      description: 'Internal padding size',
    },
    as: {
      control: { type: 'text' },
      description: 'HTML element or React component to render as',
    },
    interactive: {
      control: { type: 'boolean' },
      description: 'Enable hover effects and interactive styling',
    },
    role: {
      control: { type: 'text' },
      description: 'ARIA role for accessibility',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
    children: {
      control: { type: 'text' },
      description: 'Content to display inside the paper',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic story
export const Default: Story = {
  args: {
    children: 'This is a default Paper component with raised elevation and medium padding.',
  },
};

// Elevation variants
export const Elevations: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      <Paper elevation="raised" padding="lg">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Raised</h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          Appears to lift above the surface
        </p>
      </Paper>
      <Paper elevation="recessed" padding="lg">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Recessed</h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          Appears to sink into the surface
        </p>
      </Paper>
      <Paper elevation="flat" padding="lg">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Flat</h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          Subtle shadow with minimal depth
        </p>
      </Paper>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different elevation variants create various visual depths and tactile impressions.',
      },
    },
  },
};

// Padding sizes
export const PaddingSizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {(['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const).map((size) => (
        <Paper key={size} padding={size} elevation="raised">
          <div style={{ fontSize: '14px', textAlign: 'center' }}>
            <strong>{size.toUpperCase()}</strong>
            <br />
            <span style={{ opacity: 0.7 }}>padding</span>
          </div>
        </Paper>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Various padding sizes from extra small (xs) to extra extra large (xxl).',
      },
    },
  },
};

// Interactive examples
export const Interactive: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      <Paper elevation="raised" padding="lg" interactive>
        <div style={{ textAlign: 'center', cursor: 'pointer' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Interactive Raised</h3>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
            Hover me for animation
          </p>
        </div>
      </Paper>
      <Paper elevation="recessed" padding="lg" interactive>
        <div style={{ textAlign: 'center', cursor: 'pointer' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Interactive Recessed</h3>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
            Subtle hover effect
          </p>
        </div>
      </Paper>
      <Paper elevation="flat" padding="lg" interactive>
        <div style={{ textAlign: 'center', cursor: 'pointer' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Interactive Flat</h3>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
            Enhanced shadow on hover
          </p>
        </div>
      </Paper>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Interactive papers with hover animations. Each elevation type has different hover effects.',
      },
    },
  },
};

// Polymorphic examples
export const Polymorphic: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Paper as="section" padding="lg" role="region" aria-label="Content section">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>As Section</h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          Semantic HTML section element with region role
        </p>
      </Paper>
      
      <Paper as="article" padding="lg" role="article">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>As Article</h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          Semantic HTML article element
        </p>
      </Paper>
      
      <Paper 
        as="button" 
        padding="lg" 
        interactive 
        onClick={() => alert('Paper button clicked!')}
        style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>As Button</h3>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          Clickable button element - try clicking me!
        </p>
      </Paper>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The Paper component can render as any HTML element using the "as" prop while maintaining all styling.',
      },
    },
  },
};

// Content examples
export const WithContent: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <Paper elevation="raised" padding="xl">
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Card Title</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', opacity: 0.8 }}>
          This is a more complex example showing how Paper can be used as a card container 
          with various content types including headings, paragraphs, and interactive elements.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Paper as="button" padding="sm" elevation="flat" interactive 
                 style={{ border: 'none', background: 'transparent', fontSize: '12px' }}>
            Action 1
          </Paper>
          <Paper as="button" padding="sm" elevation="flat" interactive
                 style={{ border: 'none', background: 'transparent', fontSize: '12px' }}>
            Action 2
          </Paper>
        </div>
      </Paper>
      
      <Paper elevation="recessed" padding="lg">
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            backgroundColor: 'var(--color-text-secondary)', 
            borderRadius: '50%', 
            margin: '0 auto 16px auto',
            opacity: 0.3
          }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Feature</h3>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
            Recessed style works well for input areas or contained content
          </p>
        </div>
      </Paper>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples of Paper being used with realistic content layouts.',
      },
    },
  },
};

// Accessibility example
export const Accessibility: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Paper 
        as="button"
        padding="lg"
        interactive
        role="button"
        aria-label="Accessible interactive paper"
        aria-describedby="paper-description"
        tabIndex={0}
        style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            alert('Activated via keyboard!');
          }
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
          Keyboard Accessible
        </h3>
        <p id="paper-description" style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          This paper is fully keyboard accessible. Try tabbing to it and pressing Enter or Space.
        </p>
      </Paper>
      
      <Paper 
        as="section"
        padding="lg"
        role="region"
        aria-labelledby="content-title"
        aria-describedby="content-desc"
      >
        <h3 id="content-title" style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
          Semantic Content
        </h3>
        <p id="content-desc" style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          This paper uses semantic HTML with proper ARIA labeling for screen readers.
        </p>
      </Paper>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples demonstrating proper accessibility implementation with ARIA attributes and keyboard navigation.',
      },
    },
  },
};

// Theme showcase (would need theme switching context in real app)
export const ThemeShowcase: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      <div style={{ padding: '24px', backgroundColor: 'var(--color-bg-primary)', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', opacity: 0.7 }}>
          Current Theme
        </h4>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Paper elevation="raised" padding="md">Raised</Paper>
          <Paper elevation="recessed" padding="md">Recessed</Paper>
          <Paper elevation="flat" padding="md">Flat</Paper>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Papers automatically adapt to the current theme. Switch between light and dark themes to see the effect.',
      },
    },
  },
};

// Playground story for testing
export const Playground: Story = {
  args: {
    elevation: 'raised',
    padding: 'md',
    interactive: false,
    as: 'div',
    role: 'generic',
    children: 'Customize this Paper component using the controls below.',
  },
  parameters: {
    docs: {
      description: {
        story: 'Use the controls panel to experiment with different Paper configurations.',
      },
    },
  },
};