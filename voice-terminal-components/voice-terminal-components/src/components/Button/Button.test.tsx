import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button, type ButtonProps } from './Button';

// Helper function to render Button with default props
const renderButton = (props: Partial<ButtonProps> = {}) => {
  const defaultProps: ButtonProps = {
    children: 'Test Button',
    ...props,
  };
  return render(<Button {...defaultProps} />);
};

// Mock icon component for testing
const MockIcon = () => <span data-testid="mock-icon">Icon</span>;

describe('Button', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      renderButton();
      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('renders with custom children', () => {
      renderButton({ children: 'Custom Text' });
      expect(screen.getByRole('button', { name: 'Custom Text' })).toBeInTheDocument();
    });

    it('renders without children (icon-only)', () => {
      renderButton({ children: undefined, leftIcon: <MockIcon /> });
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Test</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Variants', () => {
    it('renders primary variant by default', () => {
      renderButton();
      const button = screen.getByRole('button');
      expect(button).toHaveClass('primary');
    });

    it('renders secondary variant', () => {
      renderButton({ variant: 'secondary' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('secondary');
    });

    it('renders ghost variant', () => {
      renderButton({ variant: 'ghost' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('ghost');
    });
  });

  describe('Sizes', () => {
    it('renders medium size by default', () => {
      renderButton();
      const button = screen.getByRole('button');
      expect(button).toHaveClass('md');
    });

    it('renders small size', () => {
      renderButton({ size: 'sm' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('sm');
    });

    it('renders large size', () => {
      renderButton({ size: 'lg' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('lg');
    });
  });

  describe('Icons', () => {
    it('renders left icon', () => {
      renderButton({ leftIcon: <MockIcon /> });
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hasLeftIcon');
    });

    it('renders right icon', () => {
      renderButton({ rightIcon: <MockIcon /> });
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hasRightIcon');
    });

    it('renders both left and right icons', () => {
      renderButton({ 
        leftIcon: <span data-testid="left-icon">Left</span>,
        rightIcon: <span data-testid="right-icon">Right</span>
      });
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hasLeftIcon');
      expect(button).toHaveClass('hasRightIcon');
    });

    it('applies iconOnly class when no children and has icon', () => {
      renderButton({ children: undefined, leftIcon: <MockIcon /> });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('iconOnly');
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when loading', () => {
      renderButton({ loading: true });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('loading');
      expect(button).toHaveAttribute('aria-busy', 'true');
      
      // Check for spinner
      const spinner = button.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });

    it('hides icons when loading', () => {
      renderButton({ 
        loading: true, 
        leftIcon: <MockIcon />,
        rightIcon: <span data-testid="right-icon">Right</span>
      });
      
      // Icons should not be rendered when loading
      expect(screen.queryByTestId('mock-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
      
      // Button should not have icon classes when loading
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('hasLeftIcon');
      expect(button).not.toHaveClass('hasRightIcon');
    });

    it('prevents clicks when loading', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ loading: true, onClick: handleClick });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
      expect(button).toBeDisabled();
    });
  });

  describe('Disabled State', () => {
    it('renders disabled state', () => {
      renderButton({ disabled: true });
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('prevents clicks when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ disabled: true, onClick: handleClick });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ onClick: handleClick });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard navigation with Space key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ onClick: handleClick });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard navigation with Enter key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ onClick: handleClick });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents keyboard activation when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ disabled: true, onClick: handleClick });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');
      await user.keyboard('{Enter}');
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('prevents keyboard activation when loading', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      renderButton({ loading: true, onClick: handleClick });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');
      await user.keyboard('{Enter}');
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('calls custom onKeyDown handler', async () => {
      const user = userEvent.setup();
      const handleKeyDown = vi.fn();
      renderButton({ onKeyDown: handleKeyDown });
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('a');
      
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('Layout', () => {
    it('renders full width when specified', () => {
      renderButton({ fullWidth: true });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('fullWidth');
    });

    it('applies custom className', () => {
      renderButton({ className: 'custom-class' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('spreads additional props', () => {
      renderButton({ 'data-testid': 'custom-button' } as any);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });

  describe('Button Types', () => {
    it('renders as submit button when type is specified', () => {
      renderButton({ type: 'submit' });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('renders as reset button when type is specified', () => {
      renderButton({ type: 'reset' });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for loading state', () => {
      renderButton({ loading: true });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('has proper ARIA attributes for disabled state', () => {
      renderButton({ disabled: true });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('hides icons from screen readers', () => {
      renderButton({ leftIcon: <MockIcon /> });
      const iconContainer = screen.getByTestId('mock-icon').closest('[aria-hidden]');
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });

    it('hides spinner from screen readers', () => {
      renderButton({ loading: true });
      const button = screen.getByRole('button');
      const spinner = button.querySelector('svg');
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });

    it('is focusable when not disabled', () => {
      renderButton();
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('is not focusable when disabled', () => {
      renderButton({ disabled: true });
      const button = screen.getByRole('button');
      button.focus();
      expect(button).not.toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty children gracefully', () => {
      renderButton({ children: '' });
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles null children gracefully', () => {
      renderButton({ children: null });
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles undefined children gracefully', () => {
      renderButton({ children: undefined });
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('combines loading and disabled states correctly', () => {
      renderButton({ loading: true, disabled: true });
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('loading');
      expect(button).toHaveClass('disabled');
    });
  });
});