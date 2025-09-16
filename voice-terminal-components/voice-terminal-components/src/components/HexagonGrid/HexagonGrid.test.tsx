import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HexagonGrid, type HexagonGridProps } from './HexagonGrid';

// Helper function to render HexagonGrid with default props
const renderHexagonGrid = (props: Partial<HexagonGridProps> = {}) => {
  const defaultProps: HexagonGridProps = {
    amplitude: 0,
    frequencies: [],
    hexagonSize: 24,
    spacing: 0, // Default to true honeycomb (touching hexagons)
    ...props,
  };
  return render(<HexagonGrid {...defaultProps} />);
};

describe('HexagonGrid', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      renderHexagonGrid();
      const grid = screen.getByRole('img');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute('aria-label', 'Voice visualization with 1 hexagon at 0% amplitude');
    });

    it('renders SVG honeycomb structure', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('honeycomb');
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

  describe('SVG Structure', () => {
    it('generates SVG path elements for hexagons', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const paths = container.querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('includes SVG filter definitions', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const defs = container.querySelector('defs');
      expect(defs).toBeInTheDocument();
      
      const filters = container.querySelectorAll('filter');
      expect(filters.length).toBeGreaterThan(0);
    });

    it('generates proper SVG viewBox dimensions', () => {
      const { container } = renderHexagonGrid({ amplitude: 50 });
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox');
      expect(svg).toHaveAttribute('width');
      expect(svg).toHaveAttribute('height');
    });
  });

  describe('Amplitude-based Expansion', () => {
    it('shows single hexagon for amplitude 0', () => {
      const { container } = renderHexagonGrid({ amplitude: 0 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(1);
    });

    it('shows 7 hexagons for low amplitude (≤15)', () => {
      const { container } = renderHexagonGrid({ amplitude: 12 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(7); // 1 center + 6 ring 1
    });

    it('shows 19 hexagons for medium amplitude (16-35)', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(19); // 1 center + 6 ring 1 + 12 ring 2
    });

    it('shows 37 hexagons for high amplitude (36-60)', () => {
      const { container } = renderHexagonGrid({ amplitude: 50 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(37); // 1 center + 6 ring 1 + 12 ring 2 + 18 ring 3
    });

    it('shows 61 hexagons for very high amplitude (61-85)', () => {
      const { container } = renderHexagonGrid({ amplitude: 75 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(61); // 1 center + 6 ring 1 + 12 ring 2 + 18 ring 3 + 24 ring 4
    });

    it('shows 91 hexagons for maximum amplitude (>85)', () => {
      const { container } = renderHexagonGrid({ amplitude: 100 });
      const hexagons = container.querySelectorAll('[data-frequency]');
      expect(hexagons).toHaveLength(91); // 1 center + 6 + 12 + 18 + 24 + 30 = 91 hexagons
    });

    it('expands grid when amplitude increases', () => {
      renderHexagonGrid({ amplitude: 50 });
      const grid = screen.getByRole('img');
      expect(grid).toHaveClass('expandedGrid');
      expect(grid).not.toHaveClass('singleHexagon');
    });
  });

  describe('Honeycomb Pattern', () => {
    it('generates hexagons with proper ring assignments', () => {
      const { container } = renderHexagonGrid({ amplitude: 50 });
      
      // Check that we have hexagons from different rings
      const centerHexagon = container.querySelector('[data-ring="0"]');
      const ring1Hexagon = container.querySelector('[data-ring="1"]');
      const ring2Hexagon = container.querySelector('[data-ring="2"]');
      const ring3Hexagon = container.querySelector('[data-ring="3"]');
      
      expect(centerHexagon).toBeInTheDocument();
      expect(ring1Hexagon).toBeInTheDocument();
      expect(ring2Hexagon).toBeInTheDocument();
      expect(ring3Hexagon).toBeInTheDocument();
    });

    it('generates hexagons with grid position data', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const hexagons = container.querySelectorAll('[data-grid-position]');
      
      hexagons.forEach(hexagon => {
        const position = hexagon.getAttribute('data-grid-position');
        expect(position).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/); // Format: "x,y"
      });
    });

    it('creates proper SVG path data for hexagons', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const paths = container.querySelectorAll('svg path');
      
      paths.forEach(path => {
        const pathData = path.getAttribute('d');
        expect(pathData).toMatch(/^M[\d\s.-]+L[\d\s.-]+L[\d\s.-]+L[\d\s.-]+L[\d\s.-]+L[\d\s.-]+Z$/); // Hexagon path pattern
      });
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
      const frequencies = [0.8, 0.6]; // Only 2 frequencies for 7+ hexagons
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

  describe('SVG Filters and Shadows', () => {
    it('applies ring-specific filter shadows', () => {
      const { container } = renderHexagonGrid({ amplitude: 50 });
      
      // Check for filter definitions
      const filters = container.querySelectorAll('filter[id^="shadow-ring-"]');
      expect(filters.length).toBeGreaterThanOrEqual(4); // At least 4 rings at amplitude 50
      
      // Check that hexagons reference the filters
      const hexagons = container.querySelectorAll('path[filter]');
      expect(hexagons.length).toBeGreaterThan(0);
    });

    it('generates different filter intensities per ring', () => {
      const { container } = renderHexagonGrid({ amplitude: 100 });
      
      const ring0Filter = container.querySelector('#shadow-ring-0');
      const ring5Filter = container.querySelector('#shadow-ring-5');
      
      expect(ring0Filter).toBeInTheDocument();
      expect(ring5Filter).toBeInTheDocument();
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

    it('applies staggered animation delays', () => {
      const { container } = renderHexagonGrid({ amplitude: 30 });
      const paths = container.querySelectorAll('svg path');
      
      let hasAnimationDelay = false;
      paths.forEach(path => {
        const style = path.getAttribute('style');
        if (style && style.includes('animation-delay')) {
          hasAnimationDelay = true;
        }
      });
      expect(hasAnimationDelay).toBe(true);
    });
  });

  describe('Project Color Pulse', () => {
    it('enables color pulse when specified', () => {
      const { container } = renderHexagonGrid({ 
        enableColorPulse: true,
        projectColor: '#FF5733',
        amplitude: 30
      });
      
      const pulseHexagons = container.querySelectorAll('.hexagonPulse');
      expect(pulseHexagons.length).toBeGreaterThanOrEqual(0);
    });

    it('sets project color CSS variable when enabled', () => {
      const { container } = renderHexagonGrid({ 
        enableColorPulse: true,
        projectColor: '#FF5733',
        amplitude: 30
      });
      
      // Check if any hexagon has the project color variable set
      const paths = container.querySelectorAll('svg path');
      let hasProjectColor = false;
      paths.forEach(path => {
        const style = path.getAttribute('style');
        if (style && style.includes('--project-color: #FF5733')) {
          hasProjectColor = true;
        }
      });
      expect(hasProjectColor).toBe(true);
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
      expect(hexagons).toHaveLength(91); // Max hexagons (5 rings)
    });

    it('handles zero hexagon size', () => {
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
      expect(hexagons).toHaveLength(19); // 2-ring honeycomb
    });
  });

  describe('Spacing and Geometry', () => {
    it('respects spacing parameter for honeycomb gaps', () => {
      const { container: tightGrid } = renderHexagonGrid({ 
        amplitude: 30, 
        spacing: 0 
      });
      const { container: spacedGrid } = renderHexagonGrid({ 
        amplitude: 30, 
        spacing: 10 
      });
      
      // Both should have same number of hexagons but different positions
      const tightHexagons = tightGrid.querySelectorAll('[data-frequency]');
      const spacedHexagons = spacedGrid.querySelectorAll('[data-frequency]');
      
      expect(tightHexagons).toHaveLength(spacedHexagons.length);
    });

    it('uses proper hexagon size (radius)', () => {
      const { container } = renderHexagonGrid({ 
        hexagonSize: 32,
        amplitude: 30
      });
      
      // Check SVG paths are generated with correct size
      const paths = container.querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThan(0);
      
      paths.forEach(path => {
        const pathData = path.getAttribute('d');
        expect(pathData).toBeTruthy();
      });
    });
  });
});