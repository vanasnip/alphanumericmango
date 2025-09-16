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
const generateHexagonPath = (x: number, y: number, radius: number): string => {
  const points: [number, number][] = [];
  
  // Generate 6 points for flat-topped hexagon (starting from top-left, going clockwise)
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - (Math.PI / 6); // Start at -30° for flat top
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
  // Calculate number of rings based on amplitude (support up to 5 rings for 91 hexagons total)
  const ringCount = useMemo(() => {
    if (amplitude <= 0) return 0; // 1 hexagon (center only)
    if (amplitude <= 15) return 1; // 7 hexagons total (1 + 6)
    if (amplitude <= 35) return 2; // 19 hexagons total (1 + 6 + 12)
    if (amplitude <= 60) return 3; // 37 hexagons total (1 + 6 + 12 + 18)
    if (amplitude <= 85) return 4; // 61 hexagons total (1 + 6 + 12 + 18 + 24)
    return 5; // 91 hexagons total (1 + 6 + 12 + 18 + 24 + 30)
  }, [amplitude]);

  // Calculate hexagon positions and paths in proper honeycomb pattern
  const hexagonData = useMemo((): HexagonData[] => {
    const hexagons: HexagonData[] = [];
    
    // Hexagon geometry for flat-topped orientation
    // For hexagons to touch edge-to-edge:
    // - horizontalSpacing = 1.5 * radius (distance between centers horizontally)
    // - verticalSpacing = sqrt(3) * radius (distance between row centers)
    const radius = hexagonSize;
    const horizontalSpacing = 1.5 * radius + spacing;
    const verticalSpacing = Math.sqrt(3) * radius + spacing;
    
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
  }, [ringCount, hexagonSize, spacing]);

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

  // Generate SVG filter IDs for different shadow intensities
  const generateShadowFilters = () => {
    const filters = [];
    
    for (let ring = 0; ring <= 5; ring++) {
      const intensity = Math.max(0.8 - ring * 0.15, 0.1); // Decreasing intensity per ring
      const blurRadius = Math.max(4 - ring * 0.5, 1);
      
      filters.push(
        <filter key={`shadow-ring-${ring}`} id={`shadow-ring-${ring}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={blurRadius} />
          <feOffset dx="2" dy="2" result="offset" />
          <feFlood floodColor="rgba(22, 27, 29, 0.25)" floodOpacity={intensity} />
          <feComposite in2="offset" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      );
    }
    
    return filters;
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
          // Map frequency data to hexagons
          const frequency = frequencies[index] || 0;
          const isActive = true; // Show all hexagons for now
          
          // Calculate animation delay based on ring and position
          const animationDelay = (hexagon.ring * 100 + hexagon.index * 20) / animationSpeed;
          
          // Determine fill color based on frequency and active state
          const getFillColor = () => {
            if (enableColorPulse && projectColor && frequency > 0.5) {
              return projectColor;
            }
            return 'var(--color-bg-secondary)';
          };
          
          // Determine stroke for debugging (can be removed later)
          const getStroke = () => {
            if (process.env.NODE_ENV === 'development') {
              return `hsl(${hexagon.ring * 60}, 50%, 50%)`; // Different color per ring
            }
            return 'none';
          };

          return (
            <path
              key={`r${hexagon.ring}-i${hexagon.index}-q${hexagon.q}r${hexagon.r}`}
              d={hexagon.path}
              className={clsx(styles.hexagon, {
                [styles.hexagonActive]: isActive,
                [styles.hexagonPulse]: enableColorPulse && projectColor,
              })}
              fill={getFillColor()}
              stroke={getStroke()}
              strokeWidth={process.env.NODE_ENV === 'development' ? "0.5" : "0"}
              filter={`url(#shadow-ring-${hexagon.ring})`}
              data-frequency={frequency}
              data-ring={hexagon.ring}
              data-active={isActive}
              data-grid-position={`${hexagon.x},${hexagon.y}`}
              style={{
                animationDelay: `${animationDelay}ms`,
                ...(enableColorPulse && projectColor && {
                  '--project-color': projectColor,
                } as React.CSSProperties),
              }}
            />
          );
        })}
      </svg>
    </div>
  );
});

HexagonGrid.displayName = 'HexagonGrid';