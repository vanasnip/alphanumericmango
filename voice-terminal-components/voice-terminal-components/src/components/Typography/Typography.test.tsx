import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Typography } from './Typography';

describe('Typography', () => {
  describe('Basic rendering', () => {
    it('renders children correctly', () => {
      render(<Typography>Hello World</Typography>);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders with default props', () => {
      render(<Typography>Default text</Typography>);
      const element = screen.getByText('Default text');
      expect(element.tagName).toBe('P'); // Default element for body variant
      expect(element).toHaveClass('typography');
      expect(element).toHaveClass('variant-body');
      expect(element).toHaveClass('weight-regular');
      expect(element).toHaveClass('family-sans');
      expect(element).toHaveClass('color-primary');
    });
  });

  describe('Typography variants', () => {
    const variants = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption', 'label'] as const;
    
    variants.forEach((variant) => {
      it(`renders ${variant} variant with correct element and class`, () => {
        render(<Typography variant={variant}>Test {variant}</Typography>);
        const element = screen.getByText(`Test ${variant}`);
        
        // Check correct CSS class
        expect(element).toHaveClass(`variant-${variant}`);
        
        // Check correct HTML element for headings
        if (variant.startsWith('h')) {
          expect(element.tagName).toBe(variant.toUpperCase());
        } else if (variant === 'body') {
          expect(element.tagName).toBe('P');
        } else if (variant === 'caption') {
          expect(element.tagName).toBe('SPAN');
        } else if (variant === 'label') {
          expect(element.tagName).toBe('LABEL');
        }
      });
    });
  });

  describe('Font weights', () => {
    const weights = ['light', 'regular', 'medium', 'semibold'] as const;
    
    weights.forEach((weight) => {
      it(`applies ${weight} font weight correctly`, () => {
        render(<Typography weight={weight}>Test text</Typography>);
        const element = screen.getByText('Test text');
        expect(element).toHaveClass(`weight-${weight}`);
      });
    });
  });

  describe('Font families', () => {
    it('applies sans-serif font family', () => {
      render(<Typography family="sans">Sans serif text</Typography>);
      const element = screen.getByText('Sans serif text');
      expect(element).toHaveClass('family-sans');
    });

    it('applies monospace font family', () => {
      render(<Typography family="mono">Monospace text</Typography>);
      const element = screen.getByText('Monospace text');
      expect(element).toHaveClass('family-mono');
    });
  });

  describe('Text colors', () => {
    const colors = ['primary', 'secondary', 'bright'] as const;
    
    colors.forEach((color) => {
      it(`applies ${color} text color correctly`, () => {
        render(<Typography color={color}>Colored text</Typography>);
        const element = screen.getByText('Colored text');
        expect(element).toHaveClass(`color-${color}`);
      });
    });
  });

  describe('Polymorphic "as" prop', () => {
    it('renders as specified element when "as" prop is provided', () => {
      render(
        <Typography as="span" variant="h1">
          Span heading
        </Typography>
      );
      const element = screen.getByText('Span heading');
      expect(element.tagName).toBe('SPAN');
      expect(element).toHaveClass('variant-h1');
    });

    it('overrides default element mapping with "as" prop', () => {
      render(
        <Typography as="div" variant="h2">
          Div heading
        </Typography>
      );
      const element = screen.getByText('Div heading');
      expect(element.tagName).toBe('DIV');
      expect(element).toHaveClass('variant-h2');
    });

    it('works with interactive elements', () => {
      render(
        <Typography as="button" variant="label">
          Button text
        </Typography>
      );
      const element = screen.getByText('Button text');
      expect(element.tagName).toBe('BUTTON');
      expect(element).toHaveClass('variant-label');
    });
  });

  describe('Custom className', () => {
    it('applies custom className along with default classes', () => {
      render(
        <Typography className="custom-class">
          Custom styled text
        </Typography>
      );
      const element = screen.getByText('Custom styled text');
      expect(element).toHaveClass('custom-class');
      expect(element).toHaveClass('typography');
      expect(element).toHaveClass('variant-body');
    });
  });

  describe('HTML attributes', () => {
    it('passes through HTML attributes correctly', () => {
      render(
        <Typography 
          as="div" 
          data-testid="typography-test"
          id="custom-id"
          role="banner"
        >
          Attributed text
        </Typography>
      );
      const element = screen.getByTestId('typography-test');
      expect(element).toHaveAttribute('id', 'custom-id');
      expect(element).toHaveAttribute('role', 'banner');
    });

    it('supports event handlers', () => {
      const handleClick = vi.fn();
      render(
        <Typography as="button" onClick={handleClick}>
          Clickable text
        </Typography>
      );
      const element = screen.getByText('Clickable text');
      element.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('maintains semantic HTML structure for headings', () => {
      render(
        <div>
          <Typography variant="h1">Main Title</Typography>
          <Typography variant="h2">Subtitle</Typography>
          <Typography variant="body">Body text</Typography>
        </div>
      );
      
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      
      expect(h1).toHaveTextContent('Main Title');
      expect(h2).toHaveTextContent('Subtitle');
    });

    it('preserves label semantics when using label variant', () => {
      render(
        <div>
          <Typography variant="label" as="label" htmlFor="input-id">
            Field Label
          </Typography>
          <input id="input-id" type="text" />
        </div>
      );
      
      const label = screen.getByText('Field Label');
      const input = screen.getByRole('textbox');
      
      expect(label.tagName).toBe('LABEL');
      expect(label).toHaveAttribute('for', 'input-id');
      expect(input).toHaveAttribute('id', 'input-id');
    });
  });

  describe('Complex combinations', () => {
    it('combines multiple props correctly', () => {
      render(
        <Typography
          variant="h3"
          weight="light"
          family="mono"
          color="secondary"
          as="div"
          className="custom-heading"
        >
          Complex typography
        </Typography>
      );
      
      const element = screen.getByText('Complex typography');
      expect(element.tagName).toBe('DIV');
      expect(element).toHaveClass('typography');
      expect(element).toHaveClass('variant-h3');
      expect(element).toHaveClass('weight-light');
      expect(element).toHaveClass('family-mono');
      expect(element).toHaveClass('color-secondary');
      expect(element).toHaveClass('custom-heading');
    });
  });

  describe('Edge cases', () => {
    it('handles empty children', () => {
      render(<Typography>{''}</Typography>);
      const element = screen.getByText('', { selector: 'p' });
      expect(element).toBeInTheDocument();
    });

    it('handles null children gracefully', () => {
      render(<Typography>{null}</Typography>);
      const element = screen.getByText('', { selector: 'p' });
      expect(element).toBeInTheDocument();
    });

    it('handles complex children (React elements)', () => {
      render(
        <Typography>
          <span>Nested</span> content
        </Typography>
      );
      expect(screen.getByText('Nested')).toBeInTheDocument();
      expect(screen.getByText('content')).toBeInTheDocument();
    });
  });
});