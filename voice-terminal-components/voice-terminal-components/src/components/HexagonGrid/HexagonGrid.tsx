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
  q: number; // Hex grid Q coordinate (axial)
  r: number; // Hex grid R coordinate (axial)
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
  // Calculate number of rings based on amplitude (support up to 5 rings for 91 hexagons total)
  const ringCount = useMemo(() => {
    if (amplitude <= 0) return 0; // 1 hexagon (center only)
    if (amplitude <= 15) return 1; // 7 hexagons total (1 + 6)
    if (amplitude <= 35) return 2; // 19 hexagons total (1 + 6 + 12)
    if (amplitude <= 60) return 3; // 37 hexagons total (1 + 6 + 12 + 18)
    if (amplitude <= 85) return 4; // 61 hexagons total (1 + 6 + 12 + 18 + 24)
    return 5; // 91 hexagons total (1 + 6 + 12 + 18 + 24 + 30)
  }, [amplitude]);

  // Calculate hexagon positions in proper honeycomb pattern
  const hexagonPositions = useMemo((): HexagonPosition[] => {
    const positions: HexagonPosition[] = [];
    
    // Hexagon geometry for flat-topped orientation
    // For flat-topped hexagons to touch edge-to-edge (spacing = 0):
    // - baseHorizontalSpacing = 1.5 * hexagonSize (distance between centers)  
    // - baseVerticalSpacing = sqrt(3) * hexagonSize (distance between row centers)
    // Add spacing prop to create gaps between hexagons
    const baseHorizontalSpacing = 1.5 * hexagonSize;
    const baseVerticalSpacing = Math.sqrt(3) * hexagonSize;
    const horizontalSpacing = baseHorizontalSpacing + spacing;
    const verticalSpacing = baseVerticalSpacing + spacing;
    
    // Center hexagon (q=0, r=0)
    positions.push({ 
      x: 0, 
      y: 0, 
      ring: 0, 
      index: 0, 
      q: 0, 
      r: 0 
    });
    
    // Generate rings using proper hexagonal grid algorithm
    for (let ring = 1; ring <= ringCount; ring++) {
      let index = 0;
      
      // Direction vectors in axial coordinates (q, r)
      const directions = [
        [1, 0],   // East
        [0, 1],   // Southeast  
        [-1, 1],  // Southwest
        [-1, 0],  // West
        [0, -1],  // Northwest
        [1, -1]   // Northeast
      ];
      
      // Start at the "northeast" corner of the ring
      let q = ring;
      let r = -ring;
      
      // Walk around the ring in 6 directions
      for (let direction = 0; direction < 6; direction++) {
        const [dq, dr] = directions[direction];
        
        // Walk along each edge of the hexagon
        for (let step = 0; step < ring; step++) {
          // Convert axial coordinates to pixel coordinates for flat-topped hexagons
          // x = horizontal_spacing * q
          // y = vertical_spacing * (r + q/2)
          const x = horizontalSpacing * q;
          const y = verticalSpacing * (r + q * 0.5);
          
          positions.push({
            x,
            y,
            ring,
            index,
            q,
            r
          });
          
          index++;
          
          // Move to next position along current edge
          q += dq;
          r += dr;
        }
      }
    }
    
    return positions;
  }, [ringCount, hexagonSize, spacing]);

  // Calculate total hexagons for frequency mapping
  const totalHexagons = hexagonPositions.length;

  // Calculate grid container size
  const containerSize = useMemo(() => {
    if (ringCount === 0) return hexagonSize * 2 + 40; // Single hexagon with padding
    
    // Calculate based on hexagon spacing (including spacing prop)
    const baseHorizontalSpacing = 1.5 * hexagonSize;
    const baseVerticalSpacing = Math.sqrt(3) * hexagonSize;
    const horizontalSpacing = baseHorizontalSpacing + spacing;
    const verticalSpacing = baseVerticalSpacing + spacing;
    const hexWidth = hexagonSize * 2;
    const hexHeight = Math.sqrt(3) * hexagonSize;
    
    const maxHorizontalDistance = ringCount * horizontalSpacing;
    const maxVerticalDistance = ringCount * verticalSpacing;
    
    const width = (maxHorizontalDistance * 2) + hexWidth + 40;
    const height = (maxVerticalDistance * 2) + hexHeight + 40;
    
    return Math.max(width, height);
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
          // For initial implementation: make all hexagons visible (we'll add probability later)
          const isActive = true; // Show all hexagons for now to verify honeycomb structure
          
          // Calculate animation delay based on ring and position for wave effects
          const animationDelay = (position.ring * 100 + position.index * 20) / animationSpeed;
          
          const hexagonStyle: React.CSSProperties = {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
          };

          return (
            <div
              key={`r${position.ring}-i${position.index}-q${position.q}r${position.r}`}
              className={styles.hexagonWrapper}
              style={hexagonStyle}
            >
              <Hexagon
                frequency={frequency}
                active={isActive}
                gridPosition={{ x: position.x, y: position.y }}
                ring={position.ring}
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