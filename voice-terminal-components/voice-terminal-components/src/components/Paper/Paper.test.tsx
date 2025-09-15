import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import Paper from './Paper';

describe('Paper', () => {
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<Paper>Test content</Paper>);
      
      const paper = screen.getByText('Test content');
      expect(paper).toBeInTheDocument();
      expect(paper.tagName).toBe('DIV');
      expect(paper).toHaveAttribute('role', 'generic');
    });

    it('renders children correctly', () => {
      render(
        <Paper>
          <span>Child 1</span>
          <span>Child 2</span>
        </Paper>
      );
      
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Paper className="custom-class">Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('custom-class');
    });
  });

  describe('Elevation Variants', () => {
    it('applies raised elevation by default', () => {
      render(<Paper>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('elevation-raised');
    });

    it('applies recessed elevation', () => {
      render(<Paper elevation="recessed">Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('elevation-recessed');
      expect(paper).not.toHaveClass('elevation-raised');
    });

    it('applies flat elevation', () => {
      render(<Paper elevation="flat">Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('elevation-flat');
      expect(paper).not.toHaveClass('elevation-raised');
    });
  });

  describe('Padding Sizes', () => {
    const paddingSizes = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;

    it('applies medium padding by default', () => {
      render(<Paper>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('padding-md');
    });

    paddingSizes.forEach((size) => {
      it(`applies ${size} padding`, () => {
        render(<Paper padding={size}>Content</Paper>);
        
        const paper = screen.getByText('Content');
        expect(paper).toHaveClass(`padding-${size}`);
        
        // Ensure other padding classes are not applied
        paddingSizes
          .filter(otherSize => otherSize !== size)
          .forEach(otherSize => {
            expect(paper).not.toHaveClass(`padding-${otherSize}`);
          });
      });
    });
  });

  describe('Polymorphic Behavior', () => {
    it('renders as div by default', () => {
      render(<Paper>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper.tagName).toBe('DIV');
    });

    it('renders as section when specified', () => {
      render(<Paper as="section">Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper.tagName).toBe('SECTION');
    });

    it('renders as article with proper semantics', () => {
      render(
        <Paper as="article" role="article">
          Article content
        </Paper>
      );
      
      const paper = screen.getByText('Article content');
      expect(paper.tagName).toBe('ARTICLE');
      expect(paper).toHaveAttribute('role', 'article');
    });

    it('renders as button and responds to clicks', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      
      render(
        <Paper as="button" onClick={handleClick}>
          Click me
        </Paper>
      );
      
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
      
      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      
      render(<Paper ref={ref}>Content</Paper>);
      
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.textContent).toBe('Content');
    });

    it('forwards ref with polymorphic as prop', () => {
      const ref = React.createRef<HTMLSectionElement>();
      
      render(<Paper as="section" ref={ref}>Content</Paper>);
      
      expect(ref.current).toBeInstanceOf(HTMLSectionElement);
      expect(ref.current?.textContent).toBe('Content');
    });
  });

  describe('Interactive Behavior', () => {
    it('does not apply interactive class by default', () => {
      render(<Paper>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).not.toHaveClass('interactive');
    });

    it('applies interactive class when interactive=true', () => {
      render(<Paper interactive>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('interactive');
    });

    it('makes interactive papers focusable when rendered as button', () => {
      render(
        <Paper as="button" interactive>
          Interactive content
        </Paper>
      );
      
      const paper = screen.getByRole('button');
      expect(paper).toHaveClass('interactive');
      expect(paper).toHaveAttribute('type', 'button');
    });
  });

  describe('Accessibility', () => {
    it('applies default generic role', () => {
      render(<Paper>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveAttribute('role', 'generic');
    });

    it('allows custom role override', () => {
      render(<Paper role="region">Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveAttribute('role', 'region');
    });

    it('supports ARIA attributes', () => {
      render(
        <Paper
          aria-label="Custom label"
          aria-describedby="description"
          data-testid="paper-element"
        >
          Content
        </Paper>
      );
      
      const paper = screen.getByTestId('paper-element');
      expect(paper).toHaveAttribute('aria-label', 'Custom label');
      expect(paper).toHaveAttribute('aria-describedby', 'description');
    });

    it('supports keyboard navigation when interactive', async () => {
      const user = userEvent.setup();
      const handleKeyDown = vi.fn();
      
      render(
        <Paper
          as="div"
          interactive
          tabIndex={0}
          onKeyDown={handleKeyDown}
          role="button"
        >
          Keyboard accessible
        </Paper>
      );
      
      const paper = screen.getByRole('button');
      expect(paper).toHaveAttribute('tabIndex', '0');
      
      paper.focus();
      expect(paper).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('Theme Integration', () => {
    it('applies base paper class for theme integration', () => {
      render(<Paper>Content</Paper>);
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('paper');
    });

    it('combines multiple classes correctly', () => {
      render(
        <Paper
          elevation="recessed"
          padding="lg"
          interactive
          className="custom-class"
        >
          Content
        </Paper>
      );
      
      const paper = screen.getByText('Content');
      expect(paper).toHaveClass('paper');
      expect(paper).toHaveClass('elevation-recessed');
      expect(paper).toHaveClass('padding-lg');
      expect(paper).toHaveClass('interactive');
      expect(paper).toHaveClass('custom-class');
    });
  });

  describe('HTML Attributes', () => {
    it('forwards standard HTML attributes', () => {
      render(
        <Paper
          id="paper-id"
          data-testid="paper-test"
          title="Paper title"
        >
          Content
        </Paper>
      );
      
      const paper = screen.getByTestId('paper-test');
      expect(paper).toHaveAttribute('id', 'paper-id');
      expect(paper).toHaveAttribute('title', 'Paper title');
    });

    it('forwards event handlers', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const handleMouseEnter = vi.fn();
      const handleMouseLeave = vi.fn();
      
      render(
        <Paper
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Content
        </Paper>
      );
      
      const paper = screen.getByText('Content');
      
      await user.click(paper);
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      await user.hover(paper);
      expect(handleMouseEnter).toHaveBeenCalledTimes(1);
      
      await user.unhover(paper);
      expect(handleMouseLeave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Display Name', () => {
    it('has correct display name for debugging', () => {
      expect(Paper.displayName).toBe('Paper');
    });
  });
});