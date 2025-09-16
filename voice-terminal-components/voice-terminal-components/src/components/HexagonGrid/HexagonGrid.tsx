import React, { memo, useMemo } from 'react';
import clsx from 'clsx';
import styles from './HexagonGrid.module.css';

export interface HexagonGridProps {
  /** Amplitude value that determines grid expansion (0-100) */
  amplitude?: number;
  /** Array of frequency values for individual hexagons (0-1) */
  frequencies?: number[];
  /** Size of individual hexagons in pixels (radius) */
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

interface HexagonData {
  x: number;
  y: number;
  ring: number;
  index: number;
  q: number; // Hex grid Q coordinate (axial)
  r: number; // Hex grid R coordinate (axial)
  path: string; // SVG path for this hexagon
}

// Generate SVG path for a flat-topped hexagon centered at (x, y) with given radius
// Using correct flat-topped hexagon math with vertices at 30° intervals from top
const generateHexagonPath = (x: number, y: number, radius: number): string => {
  const points: [number, number][] = [];
  
  // Generate 6 points for flat-topped hexagon with vertices at 30° intervals starting from top
  // Angles: [30, 90, 150, 210, 270, 330] degrees
  const angles = [30, 90, 150, 210, 270, 330];
  
  for (const angleDeg of angles) {
    const angle = (angleDeg * Math.PI) / 180;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    points.push([px, py]);
  }
  
  // Create path string: M x,y L x,y L x,y L x,y L x,y L x,y Z
  const [firstPoint, ...restPoints] = points;
  const pathCommands = [
    `M ${firstPoint[0]},${firstPoint[1]}`,
    ...restPoints.map(([px, py]) => `L ${px},${py}`),
    'Z'
  ];
  
  return pathCommands.join(' ');
};

export const HexagonGrid = memo<HexagonGridProps>(({
  amplitude = 0,
  frequencies = [],
  hexagonSize = 24,
  spacing = 0, // For true honeycomb, hexagons should touch (spacing = 0)
  projectColor,
  enableColorPulse = false,
  className,
  animationSpeed = 1,
}) => {
  // ALWAYS render all 91 hexagons (rings 0-5) - visibility controlled by amplitude-probability system
  const ringCount = 5; // Always generate all 5 rings for static grid
  
  /*
   * AMPLITUDE-PROBABILITY MAPPING SYSTEM:
   * 
   * Ring-based base probabilities:
   * - Ring 0: 100% (center hexagon always visible)
   * - Ring 1: 95% base probability 
   * - Ring 2: 75% base probability
   * - Ring 3: 50% base probability
   * - Ring 4: 25% base probability  
   * - Ring 5: 10% base probability
   * 
   * Amplitude modulation: adjustedProbability = baseProbability * (amplitude / 50)
   * - Higher amplitude = higher chance of outer rings appearing
   * - Creates expansion effect as voice gets louder
   * 
   * Random selection: Each hexagon randomly appears based on adjusted probability
   * - Creates chaotic outer ring effect
   * - More chaos in outer rings due to lower base probabilities
   * 
   * Topological variation: Visible hexagons randomly get depression/extrusion
   * - Creates varied landscape/terrain effect
   * - Maintains paper-like aesthetic with varied shadows
   */

  // Calculate hexagon positions using correct flat-topped hexagon tessellation math
  const hexagonData = useMemo((): HexagonData[] => {
    const hexagons: HexagonData[] = [];
    
    // Fixed hexagon geometry for perfect tessellation (flat-topped orientation)
    // For hexagons to touch edge-to-edge (perfect honeycomb):
    // - horizontalSpacing = 1.5 * radius (distance between centers horizontally)
    // - verticalSpacing = sqrt(3) * radius (distance between row centers vertically)
    const radius = hexagonSize;
    const horizontalSpacing = 1.5 * radius; // NO spacing parameter - always touching
    const verticalSpacing = Math.sqrt(3) * radius; // NO spacing parameter - always touching
    
    // Center hexagon (q=0, r=0)
    const centerX = 0;
    const centerY = 0;
    
    hexagons.push({
      x: centerX,
      y: centerY,
      ring: 0,
      index: 0,
      q: 0,
      r: 0,
      path: generateHexagonPath(centerX, centerY, radius)
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
          const x = horizontalSpacing * q;
          const y = verticalSpacing * (r + q * 0.5);
          
          hexagons.push({
            x,
            y,
            ring,
            index,
            q,
            r,
            path: generateHexagonPath(x, y, radius)
          });
          
          index++;
          
          // Move to next position along current edge
          q += dq;
          r += dr;
        }
      }
    }
    
    return hexagons;
  }, [hexagonSize]); // Only depend on hexagonSize, not spacing

  // Calculate SVG viewBox dimensions
  const viewBoxDimensions = useMemo(() => {
    if (ringCount === 0) {
      const size = hexagonSize * 2.5;
      return {
        width: size,
        height: size,
        viewBox: `-${size/2} -${size/2} ${size} ${size}`
      };
    }
    
    const radius = hexagonSize;
    const horizontalSpacing = 1.5 * radius + spacing;
    const verticalSpacing = Math.sqrt(3) * radius + spacing;
    
    // Calculate bounds based on outermost ring
    const maxHorizontalDistance = ringCount * horizontalSpacing + radius;
    const maxVerticalDistance = ringCount * verticalSpacing + radius;
    
    const width = maxHorizontalDistance * 2 + 20; // Add padding
    const height = maxVerticalDistance * 2 + 20;
    
    return {
      width: Math.max(width, height),
      height: Math.max(width, height),
      viewBox: `-${width/2} -${height/2} ${width} ${height}`
    };
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
    '--animation-speed': animationSpeed,
  } as React.CSSProperties;

  // Generate shadow filters for different visibility states and topology variations
  const generateShadowFilters = () => {
    return [
      // Depression filter - inverted shadow (appears pressed into paper)
      <filter key="shadow-depression" id="shadow-depression" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="-2" dy="-2" stdDeviation="3" floodOpacity="0.3" floodColor="rgba(0,0,0,0.8)" />
        <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.7" floodColor="white" />
      </filter>,
      
      // Extrusion filter - normal shadow (appears raised from paper) 
      <filter key="shadow-extrusion" id="shadow-extrusion" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.2" floodColor="rgba(0,0,0,0.6)" />
        <feDropShadow dx="-1" dy="-1" stdDeviation="2" floodOpacity="0.8" floodColor="white" />
      </filter>,
      
      // Faint filter - very subtle shadow for quiet state ring 1
      <filter key="shadow-faint" id="shadow-faint" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="-1" dy="-1" stdDeviation="3" floodOpacity="0.05" floodColor="rgba(0,0,0,0.8)" />
        <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.15" floodColor="white" />
      </filter>
    ];
  };

  return (
    <div 
      className={gridClasses}
      style={gridStyle}
      role="img"
      aria-label={`Voice visualization with ${hexagonData.length} hexagon${hexagonData.length !== 1 ? 's' : ''} at ${Math.round(amplitude)}% amplitude`}
    >
      <svg
        className={styles.honeycomb}
        viewBox={viewBoxDimensions.viewBox}
        width={viewBoxDimensions.width}
        height={viewBoxDimensions.height}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {generateShadowFilters()}
        </defs>
        
        {hexagonData.map((hexagon, index) => {
          // Determine visibility based on amplitude and ring-based probability system
          const getVisibilityFilter = (): string => {
            // Quiet state: only center visible with extrusion, ring 1 with faint shadow
            if (amplitude <= 0) {
              if (hexagon.ring === 0) return 'url(#shadow-extrusion)';
              if (hexagon.ring === 1) return 'url(#shadow-faint)';
              return 'none'; // invisible
            }
            
            // Ring-based base probabilities according to specification
            const baseRingProbabilities: Record<number, number> = {
              0: 1.00,  // Ring 0: 100% (always visible)
              1: 0.95,  // Ring 1: 95% base probability
              2: 0.75,  // Ring 2: 75% base probability
              3: 0.50,  // Ring 3: 50% base probability
              4: 0.25,  // Ring 4: 25% base probability
              5: 0.10   // Ring 5: 10% base probability
            };
            
            const baseProbability = baseRingProbabilities[hexagon.ring] || 0;
            
            // Amplitude modulation: adjustedProbability = baseProbability * (amplitude / 50)
            // This creates the effect where higher amplitude increases chance of outer rings appearing
            const amplitudeModifier = amplitude / 50;
            const adjustedProbability = Math.min(1, baseProbability * amplitudeModifier);
            
            // Random selection for chaotic outer ring effect
            const isVisible = Math.random() < adjustedProbability;
            
            if (!isVisible) return 'none';
            
            // For very quiet state (low amplitude), ring 1 gets faint shadow
            if (amplitude <= 15 && hexagon.ring === 1) {
              return 'url(#shadow-faint)';
            }
            
            // Topological variation: randomly assign depression or extrusion for landscape effect
            // This creates varied topography across the visible hexagons
            return Math.random() > 0.5 ? 'url(#shadow-depression)' : 'url(#shadow-extrusion)';
          };

          return (
            <path
              key={`r${hexagon.ring}-i${hexagon.index}-q${hexagon.q}r${hexagon.r}`}
              d={hexagon.path}
              className={styles.hexagon}
              fill="var(--color-bg-primary)"
              stroke="none"
              filter={getVisibilityFilter()}
              data-ring={hexagon.ring}
              data-grid-position={`${hexagon.x},${hexagon.y}`}
            />
          );
        })}
      </svg>
    </div>
  );
});

HexagonGrid.displayName = 'HexagonGrid';