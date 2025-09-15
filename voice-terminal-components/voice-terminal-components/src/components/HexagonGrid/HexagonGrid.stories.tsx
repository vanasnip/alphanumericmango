import type { Meta, StoryObj } from '@storybook/react';
import { HexagonGrid } from './HexagonGrid';
import { colors } from '../../theme/tokens';

const meta = {
  title: 'Components/HexagonGrid',
  component: HexagonGrid,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
HexagonGrid is a dynamic visualization component that responds to voice amplitude and frequency data. 
It starts with a single hexagon at rest and expands to multiple rings based on amplitude levels.

**Features:**
- Amplitude-based expansion (1 → 7 → 19 → 37 hexagons)
- Pure shadow-based animations for paper theme compatibility
- Individual hexagon frequency response
- Optional project color pulse effects
- Performance optimized with React.memo
- Smooth transitions between states

**Mathematical Layout:**
- Center: 1 hexagon (amplitude 0)
- Ring 1: 6 hexagons (amplitude ≤30)
- Ring 2: 12 hexagons (amplitude ≤70)  
- Ring 3: 18 hexagons (amplitude >70)
        `,
      },
    },
  },
  argTypes: {
    amplitude: {
      control: { 
        type: 'range', 
        min: 0, 
        max: 100, 
        step: 1 
      },
      description: 'Voice amplitude that controls grid expansion (0-100)',
    },
    frequencies: {
      control: 'object',
      description: 'Array of frequency values for individual hexagons (0-1)',
    },
    hexagonSize: {
      control: { 
        type: 'range', 
        min: 16, 
        max: 48, 
        step: 4 
      },
      description: 'Size of individual hexagons in pixels',
    },
    spacing: {
      control: { 
        type: 'range', 
        min: 4, 
        max: 16, 
        step: 2 
      },
      description: 'Spacing between hexagons in pixels',
    },
    projectColor: {
      control: { type: 'color' },
      description: 'Optional project color for pulse effect',
    },
    enableColorPulse: {
      control: 'boolean',
      description: 'Enable experimental project color pulse effect',
    },
    animationSpeed: {
      control: { 
        type: 'range', 
        min: 0.1, 
        max: 3, 
        step: 0.1 
      },
      description: 'Animation speed multiplier',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class names',
    },
  },
  args: {
    amplitude: 0,
    frequencies: [],
    hexagonSize: 24,
    spacing: 8,
    projectColor: colors.projects[0],
    enableColorPulse: false,
    animationSpeed: 1,
  },
} satisfies Meta<typeof HexagonGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic states
export const SingleHexagon: Story = {
  args: {
    amplitude: 0,
  },
  parameters: {
    docs: {
      description: {
        story: 'Single hexagon at rest (amplitude 0). This is the default state when no voice input is detected.',
      },
    },
  },
};

export const LowAmplitude: Story = {
  args: {
    amplitude: 25,
  },
  parameters: {
    docs: {
      description: {
        story: 'Low amplitude (≤30) shows 7 hexagons in total: 1 center + 6 in the first ring.',
      },
    },
  },
};

export const MediumAmplitude: Story = {
  args: {
    amplitude: 50,
  },
  parameters: {
    docs: {
      description: {
        story: 'Medium amplitude (31-70) shows 19 hexagons in total: 1 center + 6 in ring 1 + 12 in ring 2.',
      },
    },
  },
};

export const HighAmplitude: Story = {
  args: {
    amplitude: 85,
  },
  parameters: {
    docs: {
      description: {
        story: 'High amplitude (>70) shows 37 hexagons in total: 1 center + 6 + 12 + 18 in three rings.',
      },
    },
  },
};

// With frequency data
export const WithFrequencyData: Story = {
  args: {
    amplitude: 50,
    frequencies: [0.9, 0.7, 0.5, 0.3, 0.8, 0.6, 0.4, 0.2, 0.9, 0.1, 0.7, 0.3, 0.8, 0.5, 0.2, 0.6, 0.4, 0.9, 0.1],
  },
  parameters: {
    docs: {
      description: {
        story: 'Grid with individual frequency data for each hexagon. Each hexagon responds independently to its frequency value.',
      },
    },
  },
};

export const SimulatedAudioVisualization: Story = {
  args: {
    amplitude: 75,
    frequencies: [0.8, 0.9, 0.6, 0.4, 0.7, 0.5, 0.3, 0.8, 0.9, 0.2, 0.6, 0.7, 0.4, 0.5, 0.8, 0.3, 0.9, 0.1, 0.6],
    animationSpeed: 1.5,
  },
  parameters: {
    docs: {
      description: {
        story: 'Simulated real-time audio visualization with varied frequency data and faster animations.',
      },
    },
  },
};

// Project color variations
export const WithProjectColorPulse: Story = {
  args: {
    amplitude: 50,
    enableColorPulse: true,
    projectColor: colors.projects[0], // Yellow/Gold
  },
  parameters: {
    docs: {
      description: {
        story: 'Experimental project color pulse effect enabled. Hexagons pulse with the specified project color.',
      },
    },
  },
};

export const BlueProjectColor: Story = {
  args: {
    amplitude: 50,
    enableColorPulse: true,
    projectColor: colors.projects[1], // Blue
  },
};

export const GreenProjectColor: Story = {
  args: {
    amplitude: 50,
    enableColorPulse: true,
    projectColor: colors.projects[2], // Green
  },
};

// Size variations
export const LargeHexagons: Story = {
  args: {
    amplitude: 50,
    hexagonSize: 36,
    spacing: 12,
  },
  parameters: {
    docs: {
      description: {
        story: 'Larger hexagons with increased spacing for more prominent display.',
      },
    },
  },
};

export const SmallHexagons: Story = {
  args: {
    amplitude: 50,
    hexagonSize: 18,
    spacing: 6,
  },
  parameters: {
    docs: {
      description: {
        story: 'Smaller hexagons with tighter spacing for compact display.',
      },
    },
  },
};

// Animation variations
export const SlowAnimation: Story = {
  args: {
    amplitude: 50,
    animationSpeed: 0.5,
    frequencies: [0.7, 0.5, 0.8, 0.3, 0.6, 0.9, 0.4],
  },
  parameters: {
    docs: {
      description: {
        story: 'Slower animation speed for more relaxed visualization.',
      },
    },
  },
};

export const FastAnimation: Story = {
  args: {
    amplitude: 50,
    animationSpeed: 2,
    frequencies: [0.7, 0.5, 0.8, 0.3, 0.6, 0.9, 0.4],
  },
  parameters: {
    docs: {
      description: {
        story: 'Faster animation speed for more energetic visualization.',
      },
    },
  },
};

// Interactive playground
export const Playground: Story = {
  args: {
    amplitude: 50,
    frequencies: [0.6, 0.8, 0.4, 0.7, 0.3, 0.9, 0.5],
    hexagonSize: 24,
    spacing: 8,
    enableColorPulse: false,
    projectColor: colors.projects[0],
    animationSpeed: 1,
  },
  parameters: {
    docs: {
      description: {
        story: `
Interactive playground to explore all HexagonGrid features. Use the controls below to:

- Adjust amplitude to see grid expansion
- Modify frequency array for individual hexagon responses  
- Change hexagon size and spacing
- Enable project color pulse effects
- Adjust animation speed
        `,
      },
    },
  },
};

// Edge cases for testing
export const EdgeCases: Story = {
  args: {
    amplitude: 100,
    frequencies: [1, 0, 0.5, 1, 0, 0.5, 1, 0, 0.5, 1, 0, 0.5],
    hexagonSize: 32,
    spacing: 4,
    enableColorPulse: true,
    projectColor: colors.projects[6], // Red
    animationSpeed: 2,
  },
  parameters: {
    docs: {
      description: {
        story: 'Edge case testing with maximum amplitude, extreme frequency values, and all features enabled.',
      },
    },
  },
};

// Performance test
export const PerformanceTest: Story = {
  args: {
    amplitude: 90,
    frequencies: Array.from({ length: 37 }, (_, i) => Math.sin(i * 0.1) * 0.5 + 0.5),
    hexagonSize: 20,
    spacing: 6,
    animationSpeed: 1.5,
  },
  parameters: {
    docs: {
      description: {
        story: 'Performance test with maximum hexagons (37) and dynamic frequency data.',
      },
    },
  },
};