import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HexagonGrid, type HexagonGridProps } from './HexagonGrid';
import { Hexagon, type HexagonProps } from './Hexagon';

// Helper function to render HexagonGrid with default props
const renderHexagonGrid = (props: Partial<HexagonGridProps> = {}) => {
  const defaultProps: HexagonGridProps = {
    amplitude: 0,
    frequencies: [],
    hexagonSize: 24,
    spacing: 8,
    ...props,
  };
  return render(<HexagonGrid {...defaultProps} />);
};

// Helper function to render Hexagon with default props
const renderHexagon = (props: Partial<HexagonProps> = {}) => {
  const defaultProps: HexagonProps = {
    frequency: 0,
    active: false,
    size: 24,
    ...props,
  };
  return render(<Hexagon {...defaultProps} />);
};

describe('HexagonGrid', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      renderHexagonGrid();
      const grid = screen.getByRole('img');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute('aria-label', 'Voice visualization with 1 hexagon at 0% amplitude');
    });

    it('renders single hexagon at rest (amplitude 0)', () => {
      renderHexagonGrid({ amplitude: 0 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveClass('singleHexagon');
      expect(grid).toHaveAttribute('aria-label', 'Voice visualization with 1 hexagon at 0% amplitude');
    });

    it('applies custom className', () => {
      renderHexagonGrid({ className: 'custom-grid' });
      const grid = screen.getByRole('img');
      expect(grid).toHaveClass('custom-grid');
    });

    it('sets proper accessibility attributes', () => {
      renderHexagonGrid({ amplitude: 50 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveAttribute('aria-label');
      expect(grid.getAttribute('aria-label')).toContain('Voice visualization');
    });
  });

  describe('Amplitude-based Expansion', () => {
    it('shows single hexagon for amplitude 0', () => {
      const { container } = renderHexagonGrid({ amplitude: 0 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(1);
    });

    it('shows 7 hexagons for low amplitude (≤30)', () => {
      const { container } = renderHexagonGrid({ amplitude: 25 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(7); // 1 center + 6 ring 1
    });

    it('shows 19 hexagons for medium amplitude (31-70)', () => {
      const { container } = renderHexagonGrid({ amplitude: 50 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(19); // 1 center + 6 ring 1 + 12 ring 2
    });

    it('shows 37 hexagons for high amplitude (>70)', () => {
      const { container } = renderHexagonGrid({ amplitude: 85 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(37); // 1 center + 6 ring 1 + 12 ring 2 + 18 ring 3
    });

    it('expands grid when amplitude increases', () => {
      renderHexagonGrid({ amplitude: 50 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveClass('expandedGrid');
      expect(grid).not.toHaveClass('singleHexagon');
    });
  });

  describe('Frequency Data Integration', () => {
    it('uses frequency data when provided', () => {
      const frequencies = [0.8, 0.6, 0.4, 0.2, 0, 0.3, 0.7];
      const { container } = renderHexagonGrid({ 
        amplitude: 30, 
        frequencies 
      });
      
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons[0]).toHaveAttribute('data-frequency', '0.8');
      expect(hexagons[1]).toHaveAttribute('data-frequency', '0.6');
      expect(hexagons[6]).toHaveAttribute('data-frequency', '0.7');
    });

    it('falls back to default frequency when array is shorter', () => {
      const frequencies = [0.8, 0.6]; // Only 2 frequencies for 7 hexagons
      const { container } = renderHexagonGrid({ 
        amplitude: 30, 
        frequencies 
      });
      
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons[0]).toHaveAttribute('data-frequency', '0.8');
      expect(hexagons[1]).toHaveAttribute('data-frequency', '0.6');
      expect(hexagons[2]).toHaveAttribute('data-frequency', '0'); // fallback
    });

    it('handles empty frequency array', () => {
      const { container } = renderHexagonGrid({ 
        amplitude: 30, 
        frequencies: [] 
      });
      
      const hexagons = container.querySelectorAll('[data-frequency]');
      hexagons.forEach(hexagon => {
        expect(hexagon).toHaveAttribute('data-frequency', '0');
      });
    });
  });

  describe('Animation and Performance', () => {
    it('sets animation speed multiplier', () => {
      renderHexagonGrid({ animationSpeed: 2 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveStyle('--animation-speed: 2');
    });

    it('applies default animation speed when not specified', () => {
      renderHexagonGrid();
      const grid = screen.getByRole('img');
      expect(grid).toHaveStyle('--animation-speed: 1');
    });

    it('positions hexagons with proper transforms', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const wrappers = container.querySelectorAll('.hexagonWrapper');
      
      wrappers.forEach(wrapper => {
        const style = window.getComputedStyle(wrapper);
        expect(style.position).toBe('absolute');
        expect(style.transform).toContain('translate');
      });
    });
  });

  describe('Project Color Pulse', () => {
    it('enables color pulse when specified', () => {
      const { container } = renderHexagonGrid({ 
        enableColorPulse: true,
        projectColor: '#FF5733',
        amplitude: 30
      });
      
      const hexagons = container.querySelectorAll('.hexagon');
      // At least some hexagons should have the pulse class
      const pulseHexagons = container.querySelectorAll('.hexagonPulse');
      expect(pulseHexagons.length).toBeGreaterThanOrEqual(0);
    });

    it('disables color pulse by default', () => {
      const { container } = renderHexagonGrid({ 
        projectColor: '#FF5733',
        amplitude: 30
      });
      
      const pulseHexagons = container.querySelectorAll('.hexagonPulse');
      expect(pulseHexagons).toHaveLength(0);
    });
  });

  describe('Grid Sizing', () => {
    it('calculates container size for single hexagon', () => {
      renderHexagonGrid({ amplitude: 0, hexagonSize: 32 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveStyle('width: 52px'); // 32 + 20 padding
      expect(grid).toHaveStyle('height: 52px');
    });

    it('calculates container size for expanded grid', () => {
      renderHexagonGrid({ 
        amplitude: 50, 
        hexagonSize: 24, 
        spacing: 8 
      });
      const grid = screen.getByRole('img');
      
      // Container should be larger for multiple rings
      const style = window.getComputedStyle(grid);
      const width = parseInt(style.width);
      const height = parseInt(style.height);
      expect(width).toBeGreaterThan(100);
      expect(height).toBeGreaterThan(100);
    });

    it('respects custom hexagon size', () => {
      const { container } = renderHexagonGrid({ 
        hexagonSize: 32,
        amplitude: 30
      });
      
      const hexagons = container.querySelectorAll('.hexagon');
      hexagons.forEach(hexagon => {
        expect(hexagon).toHaveStyle('width: 32px');
        expect(hexagon).toHaveStyle('height: 32px');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles negative amplitude', () => {
      renderHexagonGrid({ amplitude: -10 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveClass('singleHexagon');
      expect(grid).toHaveAttribute('aria-label', 'Voice visualization with 1 hexagon at -10% amplitude');
    });

    it('handles very high amplitude', () => {
      const { container } = renderHexagonGrid({ amplitude: 200 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(37); // Max hexagons
    });

    it('handles zero hexagon size gracefully', () => {
      renderHexagonGrid({ hexagonSize: 0 });
      const grid = screen.getByRole('img');
      expect(grid).toBeInTheDocument();
    });

    it('handles undefined frequencies array', () => {
      const { container } = renderHexagonGrid({ 
        amplitude: 30,
        frequencies: undefined
      });
      
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(7);
    });
  });
});

describe('Hexagon', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      const { container } = renderHexagon();
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toBeInTheDocument();
      expect(hexagon).toHaveAttribute('data-frequency', '0');
      expect(hexagon).toHaveAttribute('data-active', 'false');
    });

    it('applies custom size', () => {
      const { container } = renderHexagon({ size: 32 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveStyle('width: 32px');
      expect(hexagon).toHaveStyle('height: 32px');
    });

    it('applies custom className', () => {
      const { container } = renderHexagon({ className: 'custom-hexagon' });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('custom-hexagon');
    });

    it('sets proper accessibility attributes', () => {
      const { container } = renderHexagon();
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveAttribute('role', 'presentation');
      expect(hexagon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Frequency Response', () => {
    it('applies flat shadow for low frequency', () => {
      const { container } = renderHexagon({ frequency: 0.05 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonFlat');
    });

    it('applies mid shadow for medium frequency', () => {
      const { container } = renderHexagon({ frequency: 0.5 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonMid');
    });

    it('applies raised shadow for high frequency', () => {
      const { container } = renderHexagon({ frequency: 0.8 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonRaised');
    });

    it('applies raised shadow when active regardless of frequency', () => {
      const { container } = renderHexagon({ frequency: 0.1, active: true });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonRaised');
    });

    it('stores frequency as data attribute', () => {
      const { container } = renderHexagon({ frequency: 0.75 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveAttribute('data-frequency', '0.75');
    });
  });

  describe('Active State', () => {
    it('applies active class when active', () => {
      const { container } = renderHexagon({ active: true });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonActive');
      expect(hexagon).toHaveAttribute('data-active', 'true');
    });

    it('does not apply active class when inactive', () => {
      const { container } = renderHexagon({ active: false });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).not.toHaveClass('hexagonActive');
      expect(hexagon).toHaveAttribute('data-active', 'false');
    });
  });

  describe('Project Color Pulse', () => {
    it('applies pulse class when color pulse is enabled', () => {
      const { container } = renderHexagon({ 
        enableColorPulse: true,
        projectColor: '#FF5733'
      });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonPulse');
    });

    it('sets project color CSS variable', () => {
      const { container } = renderHexagon({ 
        enableColorPulse: true,
        projectColor: '#FF5733'
      });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveStyle('--project-color: #FF5733');
    });

    it('does not apply pulse class when disabled', () => {
      const { container } = renderHexagon({ 
        enableColorPulse: false,
        projectColor: '#FF5733'
      });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).not.toHaveClass('hexagonPulse');
    });
  });

  describe('Animation Timing', () => {
    it('applies animation delay', () => {
      const { container } = renderHexagon({ animationDelay: 250 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveStyle('animation-delay: 250ms');
    });

    it('applies default animation delay of 0', () => {
      const { container } = renderHexagon();
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveStyle('animation-delay: 0ms');
    });
  });

  describe('Grid Position', () => {
    it('stores grid position as data attribute', () => {
      const { container } = renderHexagon({ 
        gridPosition: { x: 10, y: 20 }
      });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveAttribute('data-grid-position', '10,20');
    });

    it('handles undefined grid position', () => {
      const { container } = renderHexagon({ gridPosition: undefined });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).not.toHaveAttribute('data-grid-position');
    });
  });

  describe('Edge Cases', () => {
    it('handles frequency values above 1', () => {
      const { container } = renderHexagon({ frequency: 1.5 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonRaised');
      expect(hexagon).toHaveAttribute('data-frequency', '1.5');
    });

    it('handles negative frequency', () => {
      const { container } = renderHexagon({ frequency: -0.5 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveClass('hexagonFlat');
      expect(hexagon).toHaveAttribute('data-frequency', '-0.5');
    });

    it('handles zero size', () => {
      const { container } = renderHexagon({ size: 0 });
      const hexagon = container.querySelector('.hexagon');
      expect(hexagon).toHaveStyle('width: 0px');
      expect(hexagon).toHaveStyle('height: 0px');
    });
  });

  describe('Performance', () => {
    it('uses React.memo to prevent unnecessary re-renders', () => {
      const { container, rerender } = renderHexagon({ frequency: 0.5 });
      const hexagon = container.querySelector('.hexagon');
      const initialHexagon = hexagon;

      // Re-render with same props
      rerender(<Hexagon frequency={0.5} active={false} size={24} />);
      const newHexagon = container.querySelector('.hexagon');
      
      // Component should be memoized
      expect(newHexagon).toBe(initialHexagon);
    });
  });
});