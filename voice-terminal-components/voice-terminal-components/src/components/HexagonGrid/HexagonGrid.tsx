import React, { memo, useMemo } from 'react';
import clsx from 'clsx';
import { Hexagon } from './Hexagon';
import styles from './HexagonGrid.module.css';

export interface HexagonGridProps {
  /** Amplitude value that determines grid expansion (0-100) */
  amplitude?: number;
  /** Array of frequency values for individual hexagons (0-1) */
  frequencies?: number[];
  /** Size of individual hexagons in pixels */
  hexagonSize?: number;
  /** Spacing between hexagons in pixels */
  spacing?: number;
  /** Optional project color for pulse effect */
  projectColor?: string;
  /** Enable experimental project color pulse effect */
  enableColorPulse?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Animation speed multiplier */
  animationSpeed?: number;
}

interface HexagonPosition {
  x: number;
  y: number;
  ring: number;
  index: number;
  angle?: number;
}

export const HexagonGrid = memo<HexagonGridProps>(({
  amplitude = 0,
  frequencies = [],
  hexagonSize = 24,
  spacing = 8,
  projectColor,
  enableColorPulse = false,
  className,
  animationSpeed = 1,
}) => {
  // Calculate number of rings based on amplitude
  const ringCount = useMemo(() => {
    if (amplitude <= 0) return 0; // Single hexagon
    if (amplitude <= 30) return 1; // 7 hexagons total (1 + 6)
    if (amplitude <= 70) return 2; // 19 hexagons total (1 + 6 + 12)
    return 3; // 37 hexagons total (1 + 6 + 12 + 18)
  }, [amplitude]);

  // Calculate hexagon positions in honeycomb pattern
  const hexagonPositions = useMemo((): HexagonPosition[] => {
    const positions: HexagonPosition[] = [];
    
    // Center hexagon
    positions.push({ x: 0, y: 0, ring: 0, index: 0 });
    
    // Add rings based on amplitude
    for (let ring = 1; ring <= ringCount; ring++) {
      const hexagonsInRing = ring * 6;
      const radius = ring * (hexagonSize + spacing) * 0.866; // Hex grid spacing
      
      for (let i = 0; i < hexagonsInRing; i++) {
        const angle = (i * 360) / hexagonsInRing;
        const angleRad = (angle * Math.PI) / 180;
        
        const x = Math.cos(angleRad) * radius;
        const y = Math.sin(angleRad) * radius;
        
        positions.push({ 
          x, 
          y, 
          ring, 
          index: i,
          angle: angle 
        });
      }
    }
    
    return positions;
  }, [ringCount, hexagonSize, spacing]);

  // Calculate total hexagons for frequency mapping
  const totalHexagons = hexagonPositions.length;

  // Calculate grid container size
  const containerSize = useMemo(() => {
    if (ringCount === 0) return hexagonSize + 20; // Single hexagon with padding
    
    const maxRadius = ringCount * (hexagonSize + spacing) * 0.866;
    return (maxRadius * 2) + hexagonSize + 40; // Add padding
  }, [ringCount, hexagonSize, spacing]);

  const gridClasses = clsx(
    styles.hexagonGrid,
    {
      [styles.singleHexagon]: ringCount === 0,
      [styles.expandedGrid]: ringCount > 0,
    },
    className
  );

  const gridStyle: React.CSSProperties = {
    width: `${containerSize}px`,
    height: `${containerSize}px`,
    '--animation-speed': animationSpeed,
  } as React.CSSProperties;

  return (
    <div 
      className={gridClasses}
      style={gridStyle}
      role="img"
      aria-label={`Voice visualization with ${totalHexagons} hexagon${totalHexagons !== 1 ? 's' : ''} at ${Math.round(amplitude)}% amplitude`}
    >
      <div className={styles.hexagonContainer}>
        {hexagonPositions.map((position, index) => {
          // Map frequency data to hexagons, with fallback to amplitude-based activity
          const frequency = frequencies[index] || 0;
          const isActive = amplitude > 10 && (frequency > 0.3 || Math.random() < amplitude / 100);
          
          // Calculate animation delay based on distance from center and ring
          const animationDelay = (position.ring * 50 + position.index * 10) / animationSpeed;
          
          const hexagonStyle: React.CSSProperties = {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
          };

          return (
            <div
              key={`${position.ring}-${position.index}`}
              className={styles.hexagonWrapper}
              style={hexagonStyle}
            >
              <Hexagon
                frequency={frequency}
                active={isActive}
                gridPosition={{ x: position.x, y: position.y }}
                projectColor={projectColor}
                enableColorPulse={enableColorPulse}
                size={hexagonSize}
                animationDelay={animationDelay}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

HexagonGrid.displayName = 'HexagonGrid';