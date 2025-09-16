import React, { memo } from 'react';
import clsx from 'clsx';
import styles from './HexagonGrid.module.css';

export interface HexagonProps {
  /** Frequency value affecting hexagon depth (0-1) */
  frequency?: number;
  /** Whether the hexagon is active/raised */
  active?: boolean;
  /** Grid position for animation delay */
  gridPosition?: { x: number; y: number };
  /** Ring number for depth-based shadow effects (0-5) */
  ring?: number;
  /** Optional project color for pulse effect */
  projectColor?: string;
  /** Enable project color pulse effect */
  enableColorPulse?: boolean;
  /** Size of the hexagon in pixels */
  size?: number;
  /** Additional CSS class names */
  className?: string;
  /** Animation delay offset for staggered effects */
  animationDelay?: number;
}

export const Hexagon = memo<HexagonProps>(({
  frequency = 0,
  active = false,
  gridPosition,
  ring = 0,
  projectColor,
  enableColorPulse = false,
  size = 24,
  className,
  animationDelay = 0,
}) => {
  // Calculate shadow intensity based on frequency (0-1 range)
  const shadowIntensity = Math.min(frequency * 1.5, 1);
  
  // Determine shadow style based on frequency and active state
  const getShadowClass = () => {
    if (!active && frequency < 0.1) return styles.hexagonFlat;
    if (frequency > 0.7 || active) return styles.hexagonRaised;
    return styles.hexagonMid;
  };

  const hexagonClasses = clsx(
    styles.hexagon,
    getShadowClass(),
    {
      [styles.hexagonActive]: active,
      [styles.hexagonPulse]: enableColorPulse && projectColor,
    },
    className
  );

  const hexagonStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${animationDelay}ms`,
    ...(enableColorPulse && projectColor && {
      '--project-color': projectColor,
    } as React.CSSProperties),
  };

  return (
    <div
      className={hexagonClasses}
      style={hexagonStyle}
      data-frequency={frequency}
      data-active={active}
      data-ring={ring}
      data-grid-position={gridPosition ? `${gridPosition.x},${gridPosition.y}` : undefined}
      role="presentation"
      aria-hidden="true"
    />
  );
});

Hexagon.displayName = 'Hexagon';