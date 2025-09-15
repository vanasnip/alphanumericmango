import type { Meta, StoryObj } from '@storybook/react';
import { Typography } from './Typography';

const meta: Meta<typeof Typography> = {
  title: 'Components/Typography',
  component: Typography,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A flexible Typography component that supports various text variants, font weights, families, and colors.
Features polymorphic behavior with the "as" prop to render as any HTML element while maintaining semantic meaning.

**Key Features:**
- Semantic HTML elements based on variant
- Polymorphic "as" prop for custom elements
- Support for both sans-serif and monospace fonts
- Multiple font weights from the design system
- Text color variants
- Responsive typography scaling
        `
      }
    }
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption', 'label'],
      description: 'Typography variant that determines font size and semantic element'
    },
    weight: {
      control: 'select',
      options: ['light', 'regular', 'medium', 'semibold'],
      description: 'Font weight from design tokens'
    },
    family: {
      control: 'select',
      options: ['sans', 'mono'],
      description: 'Font family - sans-serif or monospace'
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'bright'],
      description: 'Text color from design tokens'
    },
    as: {
      control: 'text',
      description: 'HTML element to render as (polymorphic)'
    },
    children: {
      control: 'text',
      description: 'Content to display'
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    }
  },
  args: {
    children: 'Sample text'
  }
};

export default meta;
type Story = StoryObj<typeof Typography>;

// Basic variants showcase
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Typography variant="h1">Heading 1 - Main Title</Typography>
      <Typography variant="h2">Heading 2 - Section Title</Typography>
      <Typography variant="h3">Heading 3 - Subsection Title</Typography>
      <Typography variant="h4">Heading 4 - Article Title</Typography>
      <Typography variant="h5">Heading 5 - Minor Heading</Typography>
      <Typography variant="h6">Heading 6 - Small Heading</Typography>
      <Typography variant="body">
        Body text - This is the standard paragraph text used for most content. 
        It provides comfortable reading with proper line height and spacing.
      </Typography>
      <Typography variant="caption">Caption text - Used for supplementary information</Typography>
      <Typography variant="label">Label text - Used for form labels and UI elements</Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows all available typography variants with their default styling and semantic HTML elements.'
      }
    }
  }
};

// Font weight variations
export const FontWeights: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Typography variant="h3" weight="light">Light Weight Text</Typography>
      <Typography variant="h3" weight="regular">Regular Weight Text</Typography>
      <Typography variant="h3" weight="medium">Medium Weight Text</Typography>
      <Typography variant="h3" weight="semibold">Semibold Weight Text</Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates all available font weights that can be applied to any variant.'
      }
    }
  }
};

// Font family variations
export const FontFamilies: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Typography variant="h4" family="sans">Sans-serif Font Family</Typography>
        <Typography variant="body" family="sans">
          This uses the Inter font family for clean, modern readability in user interfaces.
        </Typography>
      </div>
      <div>
        <Typography variant="h4" family="mono">Monospace Font Family</Typography>
        <Typography variant="body" family="mono">
          This uses JetBrains Mono for code, data, and technical content where character alignment matters.
        </Typography>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows the difference between sans-serif and monospace font families.'
      }
    }
  }
};

// Color variations
export const TextColors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Typography variant="h4" color="primary">Primary Text Color</Typography>
      <Typography variant="h4" color="secondary">Secondary Text Color</Typography>
      <Typography variant="h4" color="bright">Bright Text Color</Typography>
      <Typography variant="body" color="primary">
        Primary color is used for main content and important text.
      </Typography>
      <Typography variant="body" color="secondary">
        Secondary color is used for less prominent text and descriptions.
      </Typography>
      <Typography variant="body" color="bright">
        Bright color is used for emphasis and highlighted content.
      </Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the different text color options available in the design system.'
      }
    }
  }
};

// Polymorphic behavior
export const PolymorphicExamples: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Typography variant="h3">Default H3 (renders as h3 element)</Typography>
      </div>
      <div>
        <Typography variant="h3" as="div">H3 styling on div element</Typography>
      </div>
      <div>
        <Typography variant="label" as="label" htmlFor="example-input">
          Form Label (renders as label element)
        </Typography>
        <input id="example-input" type="text" placeholder="Example input" style={{ marginLeft: '8px' }} />
      </div>
      <div>
        <Typography variant="body" as="button" style={{ background: 'none', border: '1px solid', padding: '8px 16px', cursor: 'pointer' }}>
          Button with body text styling
        </Typography>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows how the "as" prop allows you to use typography styling on any HTML element while maintaining the visual appearance.'
      }
    }
  }
};

// Complex combinations
export const ComplexCombinations: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Typography variant="h2" weight="light" color="secondary" family="mono">
        Light Monospace Heading
      </Typography>
      <Typography variant="body" weight="semibold" color="bright">
        Bold bright body text for emphasis
      </Typography>
      <Typography variant="caption" weight="medium" family="mono" color="secondary">
        Medium weight monospace caption
      </Typography>
      <Typography 
        variant="h4" 
        weight="regular" 
        family="sans" 
        color="primary"
        as="div"
        className="custom-styling"
        style={{ borderLeft: '4px solid currentColor', paddingLeft: '16px' }}
      >
        H4 styling with custom element and inline styles
      </Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples of combining multiple props to create custom typography styles.'
      }
    }
  }
};

// Interactive playground - individual controls
export const Playground: Story = {
  args: {
    variant: 'body',
    weight: 'regular',
    family: 'sans',
    color: 'primary',
    children: 'Customize this text using the controls below'
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive playground to experiment with all Typography props. Use the controls in the sidebar to modify the text.'
      }
    }
  }
};

// Responsive behavior preview
export const ResponsiveTypography: Story = {
  render: () => (
    <div>
      <Typography variant="h1" style={{ marginBottom: '16px' }}>
        Responsive Heading
      </Typography>
      <Typography variant="body">
        This heading demonstrates responsive typography. On larger screens (768px+), 
        headings automatically scale up for better hierarchy and readability. 
        Resize your browser window to see the effect.
      </Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Typography automatically scales on larger screens for better hierarchy. Resize the viewport to see responsive behavior.'
      }
    }
  }
};

// Usage in forms
export const FormUsage: Story = {
  render: () => (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
      <div>
        <Typography variant="h4" style={{ marginBottom: '16px' }}>
          Contact Form
        </Typography>
      </div>
      <div>
        <Typography variant="label" as="label" htmlFor="name" style={{ display: 'block', marginBottom: '4px' }}>
          Full Name
        </Typography>
        <input id="name" type="text" style={{ width: '100%', padding: '8px' }} />
      </div>
      <div>
        <Typography variant="label" as="label" htmlFor="email" style={{ display: 'block', marginBottom: '4px' }}>
          Email Address
        </Typography>
        <input id="email" type="email" style={{ width: '100%', padding: '8px' }} />
        <Typography variant="caption" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
          We'll never share your email with anyone else.
        </Typography>
      </div>
      <div>
        <Typography variant="label" as="label" htmlFor="message" style={{ display: 'block', marginBottom: '4px' }}>
          Message
        </Typography>
        <textarea id="message" rows={4} style={{ width: '100%', padding: '8px' }} />
      </div>
    </form>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of using Typography in forms with proper semantic labeling and accessibility.'
      }
    }
  }
};

// Code display
export const CodeDisplay: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Typography variant="h4">Code Examples</Typography>
      <div>
        <Typography variant="label" style={{ marginBottom: '8px', display: 'block' }}>
          JavaScript Function:
        </Typography>
        <Typography 
          variant="body" 
          family="mono" 
          as="pre" 
          style={{ 
            background: 'var(--color-bg-secondary)', 
            padding: '12px', 
            borderRadius: '4px',
            overflow: 'auto'
          }}
        >
{`function calculateTotal(items) {
  return items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
}`}
        </Typography>
      </div>
      <div>
        <Typography variant="label" style={{ marginBottom: '8px', display: 'block' }}>
          Inline code:
        </Typography>
        <Typography variant="body">
          Use the <Typography as="code" family="mono" style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '2px' }}>useState</Typography> hook 
          to manage component state in React.
        </Typography>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples of using Typography for code display with monospace fonts and proper styling.'
      }
    }
  }
};