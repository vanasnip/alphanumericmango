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
  path: string;
  ring: number;
  index: number;
}

// Exact hexagon paths from filled.svg organized by ring distance from center
// Center is approximately at (630, 364) based on the SVG layout
const hexagonPaths: HexagonData[] = [
  // Ring 0 - Center hexagon
  { path: "M630 156L720 208V312L630 364L540 312V208L630 156Z", ring: 0, index: 0 },
  
  // Ring 1 - 6 hexagons around center
  { path: "M720 312L810 364V468L720 520L630 468V364L720 312Z", ring: 1, index: 0 },
  { path: "M540 312L630 364V468L540 520L450 468V364L540 312Z", ring: 1, index: 1 },
  { path: "M450 364L540 312V208L450 156L360 208V312L450 364Z", ring: 1, index: 2 },
  { path: "M540 208L630 156V52L540 -1.01328e-05L450 52V156L540 208Z", ring: 1, index: 3 },
  { path: "M720 208L810 156V52L720 -1.01328e-05L630 52V156L720 208Z", ring: 1, index: 4 },
  { path: "M810 156L900 208V312L810 364L720 312V208L810 156Z", ring: 1, index: 5 },
  
  // Ring 2 - 12 hexagons in second ring
  { path: "M900 312L990 364V468L900 520L810 468V364L900 312Z", ring: 2, index: 0 },
  { path: "M810 468L900 520V624L810 676L720 624V520L810 468Z", ring: 2, index: 1 },
  { path: "M630 468L720 520V624L630 676L540 624V520L630 468Z", ring: 2, index: 2 },
  { path: "M450 468L540 520V624L450 676L360 624V520L450 468Z", ring: 2, index: 3 },
  { path: "M360 312L450 364V468L360 520L270 468V364L360 312Z", ring: 2, index: 4 },
  { path: "M270 364L360 312V208L270 156L180 208V312L270 364Z", ring: 2, index: 5 },
  { path: "M360 208L450 156V52L360 -1.01328e-05L270 52V156L360 208Z", ring: 2, index: 6 },
  { path: "M900 208L990 156V52L900 -1.01328e-05L810 52V156L900 208Z", ring: 2, index: 7 },
  { path: "M1080 312L1170 364V468L1080 520L990 468V364L1080 312Z", ring: 2, index: 8 },
  { path: "M990 364L1080 312V208L990 156L900 208V312L990 364Z", ring: 2, index: 9 },
  { path: "M720 624L810 676V780L720 832L630 780V676L720 624Z", ring: 2, index: 10 },
  { path: "M540 624L630 676V780L540 832L450 780V676L540 624Z", ring: 2, index: 11 },
  
  // Ring 3 - 18 hexagons in third ring
  { path: "M990 468L1080 520V624L990 676L900 624V520L990 468Z", ring: 3, index: 0 },
  { path: "M900 624L990 676V780L900 832L810 780V676L900 624Z", ring: 3, index: 1 },
  { path: "M810 780L900 832V936L810 988L720 936V832L810 780Z", ring: 3, index: 2 },
  { path: "M630 780L720 832V936L630 988L540 936V832L630 780Z", ring: 3, index: 3 },
  { path: "M450 780L540 832V936L450 988L360 936V832L450 780Z", ring: 3, index: 4 },
  { path: "M360 624L450 676V780L360 832L270 780V676L360 624Z", ring: 3, index: 5 },
  { path: "M270 676L360 624V520L270 468L180 520V624L270 676Z", ring: 3, index: 6 },
  { path: "M180 520L270 468V364L180 312L90 364V468L180 520Z", ring: 3, index: 7 },
  { path: "M1170 468L1260 520V624L1170 676L1080 624V520L1170 468Z", ring: 3, index: 8 },
  { path: "M1080 832L1170 780V676L1080 624L990 676V780L1080 832Z", ring: 3, index: 9 },
  { path: "M990 780L1080 832V936L990 988L900 936V832L990 780Z", ring: 3, index: 10 },
  { path: "M900 936L990 988V1092L900 1144L810 1092V988L900 936Z", ring: 3, index: 11 },
  { path: "M720 936L810 988V1092L720 1144L630 1092V988L720 936Z", ring: 3, index: 12 },
  { path: "M540 936L630 988V1092L540 1144L450 1092V988L540 936Z", ring: 3, index: 13 },
  { path: "M360 936L450 988V1092L360 1144L270 1092V988L360 936Z", ring: 3, index: 14 },
  { path: "M270 780L360 832V936L270 988L180 936V832L270 780Z", ring: 3, index: 15 },
  { path: "M180 624L270 676V780L180 832L90 780V676L180 624Z", ring: 3, index: 16 },
  { path: "M90 676L180 624V520L90 468L0 520V624L90 676Z", ring: 3, index: 17 }
];

export const HexagonGrid = memo<HexagonGridProps>(({
  amplitude = 0,
  frequencies = [],
  hexagonSize = 24, // Not used anymore, but kept for API compatibility
  spacing = 0, // Not used anymore, but kept for API compatibility
  projectColor,
  enableColorPulse = false,
  className,
  animationSpeed = 1,
}) => {
  /*
   * AMPLITUDE-PROBABILITY MAPPING SYSTEM:
   * 
   * Ring-based base probabilities:
   * - Ring 0: 100% (center hexagon always visible)
   * - Ring 1: 95% base probability 
   * - Ring 2: 75% base probability
   * - Ring 3: 50% base probability
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

  // Use the exact hexagon paths from filled.svg - no calculation needed!
  const hexagonData = useMemo((): HexagonData[] => {
    return hexagonPaths;
  }, []); // No dependencies - static data

  // Use exact viewBox dimensions from filled.svg
  const viewBoxDimensions = useMemo(() => {
    return {
      width: 1260,
      height: 1144,
      viewBox: "0 0 1260 1144"
    };
  }, []);

  const gridClasses = clsx(
    styles.hexagonGrid,
    styles.expandedGrid, // Always use expanded grid style
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
              key={`r${hexagon.ring}-i${hexagon.index}`}
              d={hexagon.path}
              className={styles.hexagon}
              fill="var(--color-bg-primary)"
              stroke="none"
              filter={getVisibilityFilter()}
              data-ring={hexagon.ring}
              data-index={hexagon.index}
            />
          );
        })}
      </svg>
    </div>
  );
});

HexagonGrid.displayName = 'HexagonGrid';