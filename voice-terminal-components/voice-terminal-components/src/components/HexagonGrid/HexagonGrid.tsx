import clsx from 'clsx';
import React, { memo, useMemo } from 'react';
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
  /** Total size of the grid in pixels (100-250px recommended) */
  size?: number;
  /** Shadow blur intensity (0.5 = sharper, 2.0 = softer) */
  blurIntensity?: number;
  /** Stroke intensity (0 = no strokes, 1 = normal, 2 = strong) */
  strokeIntensity?: number;
  /** Gradient intensity (0 = no gradients, 1 = normal, 2 = strong) */
  gradientIntensity?: number;
}

interface HexagonData {
  path: string;
  ring: number;
  index: number;
}

// Exact hexagon paths reorganized based on hexagonGrid.svg ring structure
// Center is at (630, 468) - the actual center hexagon
const hexagonPaths: HexagonData[] = [
  // Ring 0 - Center hexagon (from hexagonGrid.svg id="center")
  { path: "M630 468L720 520V624L630 676L540 624V520L630 468Z", ring: 0, index: 0 },
  
  // Ring 1 - 6 hexagons around center (from hexagonGrid.svg id="first_ring")
  { path: "M720 312L810 364V468L720 520L630 468V364L720 312Z", ring: 1, index: 0 },
  { path: "M540 312L630 364V468L540 520L450 468V364L540 312Z", ring: 1, index: 1 },
  { path: "M450 468L540 520V624L450 676L360 624V520L450 468Z", ring: 1, index: 2 },
  { path: "M540 624L630 676V780L540 832L450 780V676L540 624Z", ring: 1, index: 3 },
  { path: "M810 468L900 520V624L810 676L720 624V520L810 468Z", ring: 1, index: 4 },
  { path: "M720 624L810 676V780L720 832L630 780V676L720 624Z", ring: 1, index: 5 },
  
  // Ring 2 - 12 hexagons (from hexagonGrid.svg id="second_ring")
  { path: "M990 468L1080 520V624L990 676L900 624V520L990 468Z", ring: 2, index: 0 },
  { path: "M360 312L450 364V468L360 520L270 468V364L360 312Z", ring: 2, index: 1 },
  { path: "M360 624L450 676V780L360 832L270 780V676L360 624Z", ring: 2, index: 2 },
  { path: "M450 780L540 832V936L450 988L360 936V832L450 780Z", ring: 2, index: 3 },
  { path: "M630 156L720 208V312L630 364L540 312V208L630 156Z", ring: 2, index: 4 },
  { path: "M900 624L990 676V780L900 832L810 780V676L900 624Z", ring: 2, index: 5 },
  { path: "M810 780L900 832V936L810 988L720 936V832L810 780Z", ring: 2, index: 6 },
  { path: "M630 780L720 832V936L630 988L540 936V832L630 780Z", ring: 2, index: 7 },
  { path: "M270 676L360 624V520L270 468L180 520V624L270 676Z", ring: 2, index: 8 },
  { path: "M450 364L540 312V208L450 156L360 208V312L450 364Z", ring: 2, index: 9 },
  { path: "M810 156L900 208V312L810 364L720 312V208L810 156Z", ring: 2, index: 10 },
  { path: "M900 312L990 364V468L900 520L810 468V364L900 312Z", ring: 2, index: 11 },
  
  // Ring 3 - Outer ring hexagons (from hexagonGrid.svg id="outer_ring") 
  { path: "M1170 468L1260 520V624L1170 676L1080 624V520L1170 468Z", ring: 3, index: 0 },
  { path: "M1080 312L1170 364V468L1080 520L990 468V364L1080 312Z", ring: 3, index: 1 },
  { path: "M360 208L450 156V52L360 -1.01328e-05L270 52V156L360 208Z", ring: 3, index: 2 },
  { path: "M270 364L360 312V208L270 156L180 208V312L270 364Z", ring: 3, index: 3 },
  { path: "M90 676L180 624V520L90 468L0 520V624L90 676Z", ring: 3, index: 4 },
  { path: "M180 520L270 468V364L180 312L90 364V468L180 520Z", ring: 3, index: 5 },
  { path: "M990 364L1080 312V208L990 156L900 208V312L990 364Z", ring: 3, index: 6 },
  { path: "M540 208L630 156V52L540 -1.01328e-05L450 52V156L540 208Z", ring: 3, index: 7 },
  { path: "M900 208L990 156V52L900 -1.01328e-05L810 52V156L900 208Z", ring: 3, index: 8 },
  { path: "M720 208L810 156V52L720 -1.01328e-05L630 52V156L720 208Z", ring: 3, index: 9 },
  { path: "M1080 832L1170 780V676L1080 624L990 676V780L1080 832Z", ring: 3, index: 10 },
  { path: "M360 936L450 988V1092L360 1144L270 1092V988L360 936Z", ring: 3, index: 11 },
  { path: "M270 780L360 832V936L270 988L180 936V832L270 780Z", ring: 3, index: 12 },
  { path: "M180 624L270 676V780L180 832L90 780V676L180 624Z", ring: 3, index: 13 },
  { path: "M990 780L1080 832V936L990 988L900 936V832L990 780Z", ring: 3, index: 14 },
  { path: "M540 936L630 988V1092L540 1144L450 1092V988L540 936Z", ring: 3, index: 15 },
  { path: "M900 936L990 988V1092L900 1144L810 1092V988L900 936Z", ring: 3, index: 16 },
  { path: "M720 936L810 988V1092L720 1144L630 1092V988L720 936Z", ring: 3, index: 17 }
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
  size = 200, // Default size of 200px
  blurIntensity = 1.2, // Slightly softer shadows by default
  strokeIntensity = 1, // Normal stroke intensity
  gradientIntensity = 1, // Normal gradient intensity
}) => {
  // Use blur intensity prop for shadow softening
  const blurMultiplier = blurIntensity;
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
    width: `${size}px`,
    height: `${size}px`,
  } as React.CSSProperties;

  // Generate gradients for different elevation states with 60-20-5 distribution
  const generateGradients = () => {
    return [
      // Base gradient - 60% background, 20% shadow, 5% light (standard distribution)
      <linearGradient key="gradient-base" id="gradient-base" x1="0%" y1="100%" x2="100%" y2="0%">
        {/* Shadow side (20%) */}
        <stop offset="0%" stopColor="black" stopOpacity={0.08 * gradientIntensity} />
        <stop offset="20%" stopColor="black" stopOpacity={0.08 * gradientIntensity} />
        {/* Shadow transition (7.5%) */}
        <stop offset="27.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        {/* Base zone matching background (60%) */}
        <stop offset="27.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="87.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        {/* Light transition (7.5%) */}
        <stop offset="95%" stopColor="white" stopOpacity={0.05 * gradientIntensity} />
        {/* Light side (5%) */}
        <stop offset="100%" stopColor="white" stopOpacity={0.05 * gradientIntensity} />
      </linearGradient>,
      
      // Crater gradient - 30% shadow, 50% base, 5% light (deeper shadow)
      <linearGradient key="gradient-crater" id="gradient-crater" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.12 * gradientIntensity} />
        <stop offset="30%" stopColor="black" stopOpacity={0.12 * gradientIntensity} />
        <stop offset="37.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="87.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="95%" stopColor="white" stopOpacity={0.03 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.03 * gradientIntensity} />
      </linearGradient>,
      
      // Elevated gradient - 15% shadow, 60% base, 10% light (more light)
      <linearGradient key="gradient-elevated" id="gradient-elevated" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.06 * gradientIntensity} />
        <stop offset="15%" stopColor="black" stopOpacity={0.06 * gradientIntensity} />
        <stop offset="22.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="82.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="90%" stopColor="white" stopOpacity={0.1 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.1 * gradientIntensity} />
      </linearGradient>,
      
      // High elevation gradient - 10% shadow, 60% base, 15% light (much more light)
      <linearGradient key="gradient-elevated-high" id="gradient-elevated-high" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.04 * gradientIntensity} />
        <stop offset="10%" stopColor="black" stopOpacity={0.04 * gradientIntensity} />
        <stop offset="17.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="77.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="85%" stopColor="white" stopOpacity={0.15 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.15 * gradientIntensity} />
      </linearGradient>,
      
      // Hole gradient - 35% shadow, 45% base, 5% light (deepest shadow)
      <linearGradient key="gradient-hole" id="gradient-hole" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.15 * gradientIntensity} />
        <stop offset="35%" stopColor="black" stopOpacity={0.15 * gradientIntensity} />
        <stop offset="42.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="87.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="95%" stopColor="white" stopOpacity={0.02 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.02 * gradientIntensity} />
      </linearGradient>,
      
      // Depression gradient - 25% shadow, 55% base, 5% light (moderate shadow)
      <linearGradient key="gradient-depression" id="gradient-depression" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.1 * gradientIntensity} />
        <stop offset="25%" stopColor="black" stopOpacity={0.1 * gradientIntensity} />
        <stop offset="32.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="87.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="95%" stopColor="white" stopOpacity={0.03 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.03 * gradientIntensity} />
      </linearGradient>,
      
      // Extrusion gradient - 18% shadow, 60% base, 7% light (subtle variation)
      <linearGradient key="gradient-extrusion" id="gradient-extrusion" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.07 * gradientIntensity} />
        <stop offset="18%" stopColor="black" stopOpacity={0.07 * gradientIntensity} />
        <stop offset="25.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="85.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="93%" stopColor="white" stopOpacity={0.07 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.07 * gradientIntensity} />
      </linearGradient>,
      
      // Outer ring gradients - much subtler (40% intensity)
      <linearGradient key="gradient-outer-subtle" id="gradient-outer-subtle" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="black" stopOpacity={0.03 * gradientIntensity} />
        <stop offset="20%" stopColor="black" stopOpacity={0.03 * gradientIntensity} />
        <stop offset="27.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="87.5%" stopColor="var(--color-bg-primary)" stopOpacity="1" />
        <stop offset="95%" stopColor="white" stopOpacity={0.02 * gradientIntensity} />
        <stop offset="100%" stopColor="white" stopOpacity={0.02 * gradientIntensity} />
      </linearGradient>,
    ];
  };

  // Generate shadow filters for different visibility states and topology variations
  const generateShadowFilters = () => {
    return [
      // Depression filter - stronger contrast with dark initial shadow fading to gradient
      <filter key="shadow-depression" id="shadow-depression" x="-50%" y="-50%" width="200%" height="200%">
        {/* Edge detection and subtle stroke */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.5" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="0.5" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="darkStroke"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 ${0.1 * strokeIntensity} 0" />
        <feMerge result="withStroke">
          <feMergeNode in="darkStroke" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Original shadows on stroked shape */}
        <feDropShadow in="withStroke" dx="-2" dy="-2" stdDeviation={2 * blurMultiplier} floodOpacity="0.7" floodColor="rgba(0,0,0,1)" />
        <feDropShadow dx="-4" dy="-4" stdDeviation={12 * blurMultiplier} floodOpacity="0.4" floodColor="rgba(0,0,0,0.9)" />
        <feDropShadow dx="3" dy="3" stdDeviation={8 * blurMultiplier} floodOpacity="0.9" floodColor="white" />
      </filter>,
      
      // Depression filter for outer rings - much lighter strokes (20% lighter)
      <filter key="shadow-depression-outer" id="shadow-depression-outer" x="-50%" y="-50%" width="200%" height="200%">
        {/* Much lighter edge stroke for outer rings */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.3" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="0.7" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="darkStroke"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 ${0.02 * strokeIntensity} 0" />
        <feMerge result="withStroke">
          <feMergeNode in="darkStroke" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Softer shadows for outer regions */}
        <feDropShadow in="withStroke" dx="-2" dy="-2" stdDeviation={3 * blurMultiplier} floodOpacity="0.5" floodColor="rgba(0,0,0,0.8)" />
        <feDropShadow dx="-4" dy="-4" stdDeviation={14 * blurMultiplier} floodOpacity="0.3" floodColor="rgba(0,0,0,0.7)" />
        <feDropShadow dx="3" dy="3" stdDeviation={10 * blurMultiplier} floodOpacity="0.7" floodColor="white" />
      </filter>,
      
      // Extrusion filter - sharper contrast with dark edge
      <filter key="shadow-extrusion" id="shadow-extrusion" x="-50%" y="-50%" width="200%" height="200%">
        {/* White glow stroke for elevated appearance */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="2" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="whiteGlow"
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 ${0.3 * strokeIntensity} 0" />
        <feMerge result="withStroke">
          <feMergeNode in="whiteGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Original shadows on stroked shape */}
        <feDropShadow in="withStroke" dx="2" dy="2" stdDeviation={1 * blurMultiplier} floodOpacity="0.6" floodColor="rgba(0,0,0,1)" />
        <feDropShadow dx="4" dy="4" stdDeviation={10 * blurMultiplier} floodOpacity="0.35" floodColor="rgba(0,0,0,0.8)" />
        <feDropShadow dx="-2" dy="-2" stdDeviation={6 * blurMultiplier} floodOpacity="0.95" floodColor="white" />
      </filter>,
      
      // Extrusion filter for outer rings - subtler white glow
      <filter key="shadow-extrusion-outer" id="shadow-extrusion-outer" x="-50%" y="-50%" width="200%" height="200%">
        {/* Subtle white glow for outer elevated areas */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.5" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="2.5" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="whiteGlow"
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 ${0.06 * strokeIntensity} 0" />
        <feMerge result="withStroke">
          <feMergeNode in="whiteGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Softer shadows for outer regions */}
        <feDropShadow in="withStroke" dx="2" dy="2" stdDeviation={1.5 * blurMultiplier} floodOpacity="0.4" floodColor="rgba(0,0,0,0.8)" />
        <feDropShadow dx="4" dy="4" stdDeviation={12 * blurMultiplier} floodOpacity="0.25" floodColor="rgba(0,0,0,0.6)" />
        <feDropShadow dx="-2" dy="-2" stdDeviation={8 * blurMultiplier} floodOpacity="0.7" floodColor="white" />
      </filter>,
      
      // Center crater with inner shadow - deep depression with dark edges
      <filter key="shadow-crater-center" id="shadow-crater-center" x="-50%" y="-50%" width="200%" height="200%">
        {/* Subtle dark edge stroke for crater */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.5" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="0" result="crispOutline" />
        <feColorMatrix in="crispOutline" type="matrix" result="darkEdge"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 ${0.15 * strokeIntensity} 0" />
        {/* Inner shadow effect */}
        <feGaussianBlur in="SourceAlpha" stdDeviation={8 * blurMultiplier} result="blur"/>
        <feOffset in="blur" dx="0" dy="0" result="offsetBlur"/>
        <feFlood floodColor="rgba(0,0,0,0.8)" result="color"/>
        <feComposite in="color" in2="offsetBlur" operator="in" result="shadow"/>
        <feComposite in="shadow" in2="SourceAlpha" operator="out" result="innerShadow"/>
        <feMerge>
          <feMergeNode in="darkEdge"/>
          <feMergeNode in="innerShadow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>,
      
      // Ring 1 elevated - very strong shadows with high contrast
      <filter key="shadow-rim-elevated" id="shadow-rim-elevated" x="-50%" y="-50%" width="200%" height="200%">
        {/* Strong white glow for elevated rim */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="3" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="whiteGlow"
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0.4 0" />
        <feMerge result="withStroke">
          <feMergeNode in="whiteGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Original shadows on stroked shape */}
        <feDropShadow in="withStroke" dx="3" dy="3" stdDeviation={1 * blurMultiplier} floodOpacity="0.8" floodColor="rgba(0,0,0,1)" />
        <feDropShadow dx="6" dy="6" stdDeviation={12 * blurMultiplier} floodOpacity="0.5" floodColor="rgba(0,0,0,0.9)" />
        <feDropShadow dx="-3" dy="-3" stdDeviation={8 * blurMultiplier} floodOpacity="1" floodColor="white" />
        <feDropShadow dx="10" dy="10" stdDeviation={20 * blurMultiplier} floodOpacity="0.25" floodColor="rgba(0,0,0,0.7)" />
      </filter>,
      
      // Ring 1 elevated variant - slightly different height for variation
      <filter key="shadow-rim-elevated-high" id="shadow-rim-elevated-high" x="-50%" y="-50%" width="200%" height="200%">
        {/* Extra strong white glow for highest elevation */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="4" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="whiteGlow"
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0.5 0" />
        <feMerge result="withStroke">
          <feMergeNode in="whiteGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Original shadows on stroked shape */}
        <feDropShadow in="withStroke" dx="4" dy="4" stdDeviation={1 * blurMultiplier} floodOpacity="0.85" floodColor="rgba(0,0,0,1)" />
        <feDropShadow dx="8" dy="8" stdDeviation={14 * blurMultiplier} floodOpacity="0.55" floodColor="rgba(0,0,0,0.9)" />
        <feDropShadow dx="-4" dy="-4" stdDeviation={10 * blurMultiplier} floodOpacity="1" floodColor="white" />
      </filter>,
      
      // Deep hole with inner shadow - appears punched through the paper
      <filter key="shadow-hole-deep" id="shadow-hole-deep" x="-50%" y="-50%" width="200%" height="200%">
        {/* Strong dark edge stroke for hole depth */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="1" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="darkStroke"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.25 0" />
        {/* Strong inner shadow for hole effect */}
        <feGaussianBlur in="SourceAlpha" stdDeviation={4 * blurMultiplier} result="blur"/>
        <feOffset in="blur" dx="2" dy="2" result="offsetBlur"/>
        <feFlood floodColor="rgba(0,0,0,0.9)" result="color"/>
        <feComposite in="color" in2="offsetBlur" operator="in" result="shadow"/>
        <feComposite in="shadow" in2="SourceAlpha" operator="out" result="innerShadow"/>
        <feDropShadow dx="-1" dy="-1" stdDeviation={2 * blurMultiplier} floodOpacity="0.3" floodColor="white" />
        <feMerge>
          <feMergeNode in="darkStroke"/>
          <feMergeNode in="innerShadow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>,
      
      // Medium hole - less pronounced inner shadow
      <filter key="shadow-hole-medium" id="shadow-hole-medium" x="-50%" y="-50%" width="200%" height="200%">
        {/* Moderate dark edge stroke */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.75" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="0.75" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="darkStroke"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.18 0" />
        {/* Medium inner shadow */}
        <feGaussianBlur in="SourceAlpha" stdDeviation={6 * blurMultiplier} result="blur"/>
        <feOffset in="blur" dx="0" dy="0" result="offsetBlur"/>
        <feFlood floodColor="rgba(0,0,0,0.6)" result="color"/>
        <feComposite in="color" in2="offsetBlur" operator="in" result="shadow"/>
        <feComposite in="shadow" in2="SourceAlpha" operator="out" result="innerShadow"/>
        <feMerge>
          <feMergeNode in="darkStroke"/>
          <feMergeNode in="innerShadow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>,
      
      // Faint filter - subtle shadow
      <filter key="shadow-faint" id="shadow-faint" x="-50%" y="-50%" width="200%" height="200%">
        {/* Very subtle edge definition */}
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.25" result="dilated" />
        <feGaussianBlur in="dilated" stdDeviation="0.5" result="blurredOutline" />
        <feColorMatrix in="blurredOutline" type="matrix" result="subtleEdge"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.05 0" />
        <feMerge result="withStroke">
          <feMergeNode in="subtleEdge" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
        {/* Original subtle shadows */}
        <feDropShadow in="withStroke" dx="-2" dy="-2" stdDeviation={8 * blurMultiplier} floodOpacity="0.15" floodColor="rgba(0,0,0,0.8)" />
        <feDropShadow dx="2" dy="2" stdDeviation={7 * blurMultiplier} floodOpacity="0.25" floodColor="white" />
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
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {generateGradients()}
          {generateShadowFilters()}
        </defs>
        
        {/* Render hexagons in layer order: center (bottom) → outer → second → first (top) */}
        {hexagonData
          .sort((a, b) => {
            // Sort by ring: 0 (center) → 3 (outer) → 2 (second) → 1 (first)
            const ringOrder = { 0: 0, 3: 1, 2: 2, 1: 3 };
            return (ringOrder[a.ring] || 0) - (ringOrder[b.ring] || 0);
          })
          .map((hexagon, index) => {
          // Determine visibility and gradient based on amplitude and ring-based probability system
          const getVisibilityAndGradient = (): { filter: string; fill: string } => {
            // Quiet state: center as crater, ring 1 with faint shadow
            if (amplitude <= 0) {
              if (hexagon.ring === 0) return { filter: 'url(#shadow-crater-center)', fill: 'url(#gradient-crater)' };
              if (hexagon.ring === 1) return { filter: 'url(#shadow-faint)', fill: 'var(--color-bg-primary)' };
              return { filter: 'none', fill: 'var(--color-bg-primary)' }; // invisible
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
            
            if (!isVisible) return { filter: 'none', fill: 'var(--color-bg-primary)' };
            
            // Crater topology: center is deeply depressed, ring 1 forms elevated rim
            if (hexagon.ring === 0) {
              return { filter: 'url(#shadow-crater-center)', fill: 'url(#gradient-crater)' }; // Deep depression in center
            }
            
            // Ring 1 forms the elevated rim with occasional holes for contrast
            if (hexagon.ring === 1) {
              const variation = Math.random();
              if (variation > 0.85) {
                return { filter: 'url(#shadow-hole-deep)', fill: 'url(#gradient-hole)' }; // 15% appear as holes
              } else if (variation > 0.5) {
                return { filter: 'url(#shadow-rim-elevated-high)', fill: 'url(#gradient-elevated-high)' }; // 35% highest elevation
              } else {
                return { filter: 'url(#shadow-rim-elevated)', fill: 'url(#gradient-elevated)' }; // 50% normal elevation
              }
            }
            
            // For very quiet state (low amplitude), outer rings get subtle shadows
            if (amplitude <= 15 && hexagon.ring >= 2) {
              return { filter: 'url(#shadow-faint)', fill: 'url(#gradient-outer-subtle)' };
            }
            
            // Ring 2: Mix of elevations and occasional holes with base gradient
            if (hexagon.ring === 2) {
              const variation = Math.random();
              if (variation > 0.9) {
                return { filter: 'url(#shadow-hole-medium)', fill: 'url(#gradient-hole)' }; // 10% appear as medium holes
              } else if (variation > 0.8) {
                return { filter: 'url(#shadow-hole-deep)', fill: 'url(#gradient-hole)' }; // 10% appear as deep holes
              } else if (variation > 0.5) {
                return { filter: 'url(#shadow-extrusion)', fill: 'url(#gradient-base)' }; // 30% raised with base gradient
              } else {
                return { filter: 'url(#shadow-depression)', fill: 'url(#gradient-base)' }; // 50% depressed with base gradient
              }
            }
            
            // Ring 3 (outer): Very subtle variations with outer-subtle gradient
            const outerVariation = Math.random();
            if (outerVariation > 0.85) {
              return { filter: 'url(#shadow-hole-medium)', fill: 'url(#gradient-hole)' }; // 15% medium holes (not deep)
            } else if (outerVariation > 0.75) {
              return { filter: 'url(#shadow-hole-medium)', fill: 'url(#gradient-hole)' }; // 10% medium holes
            } else if (outerVariation > 0.6) {
              return { filter: 'url(#shadow-extrusion-outer)', fill: 'url(#gradient-outer-subtle)' }; // 15% gently raised with subtle gradient
            } else if (outerVariation > 0.3) {
              return { filter: 'url(#shadow-depression-outer)', fill: 'url(#gradient-outer-subtle)' }; // 30% gently depressed with subtle gradient
            } else {
              return { filter: 'url(#shadow-extrusion-outer)', fill: 'url(#gradient-outer-subtle)' }; // 30% slightly raised with subtle gradient
            }
          };

          const visibilityAndGradient = getVisibilityAndGradient();
          
          return (
            <path
              key={`r${hexagon.ring}-i${hexagon.index}`}
              d={hexagon.path}
              className={styles.hexagon}
              fill={visibilityAndGradient.fill}
              stroke="none"
              filter={visibilityAndGradient.filter}
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