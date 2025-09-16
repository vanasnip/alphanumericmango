# HexagonGrid Fix Plan - Static Grid with Shadow-Based Visibility

## Current Issues Identified

### 1. Alignment Problems
- **Issue**: Hexagons within rings don't align properly - edges don't match for true honeycomb
- **Impact**: Breaks the connected honeycomb visual
- **Root Cause**: Likely mathematical error in positioning calculations

### 2. Unwanted Movement/Animation
- **Issue**: Hexagons are moving/animating when they should be completely static
- **Impact**: Creates chaotic, unstable appearance
- **Root Cause**: Animation keyframes or transforms being applied to position

### 3. Wrong Visibility Model
- **Current**: Hexagons appear/disappear or move
- **Required**: Static grid where visibility is controlled by shadows/opacity
- **Impact**: Current approach contradicts the design vision

## Design Vision - Core Principles

### The Grid is Permanent
- All 91 hexagons are ALWAYS present in the DOM
- Fixed positions that never change
- The structure is immutable - only appearance changes

### Visibility Through Shadows
- **Visible hexagon**: Has shadow effect (appears raised from surface)
- **Invisible hexagon**: No shadow, fill matches background exactly
- **Transition**: Shadow fades in/out, hexagon never moves

### Topological Variation
- **Depression**: Shadow inverted - appears pressed into the paper
- **Extrusion**: Normal shadow - appears raised from the paper
- **Mixed topology**: Some hexagons depressed, others raised
- **Creates landscape**: Varied heights create organic, fluid surface
- **Dynamic perception**: Subtle shadow shifts can suggest movement without actual position changes

### No Borders
- SVG paths should have NO stroke
- Only fill color (matching background)
- Shadows create the edge definition

## Implementation Plan

### Phase 1: Fix Alignment
**Goal**: Perfect honeycomb tessellation where all edges align

1. **Mathematical Review**
   - Verify hexagon vertex calculations
   - Ensure proper flat-topped orientation
   - Check ring positioning formulas
   
2. **Reference Implementation**
   ```javascript
   // For flat-topped hexagons with radius r
   // Vertices at 30° intervals starting from top
   const angles = [30, 90, 150, 210, 270, 330];
   const vertices = angles.map(angle => ({
     x: centerX + radius * Math.cos(angle * Math.PI / 180),
     y: centerY + radius * Math.sin(angle * Math.PI / 180)
   }));
   ```

3. **Ring Positioning**
   - Use axial coordinates (q, r) for precise placement
   - Convert to pixel positions with exact spacing
   - No gaps between adjacent hexagons

### Phase 2: Remove All Movement
**Goal**: Completely static grid structure

1. **Remove Animations**
   - Delete all position-based keyframes
   - Remove transform animations
   - Keep only opacity/filter transitions

2. **Static Positioning**
   - Use absolute SVG coordinates
   - No dynamic position calculations
   - Fixed viewBox dimensions

### Phase 3: Shadow-Based Visibility
**Goal**: Visibility controlled entirely through shadows

1. **Shadow States**
   ```css
   /* Visible hexagon */
   .hexagon-visible {
     fill: var(--background-color);
     filter: url(#neumorphic-shadow);
     opacity: 1;
   }
   
   /* Invisible hexagon */
   .hexagon-invisible {
     fill: var(--background-color);
     filter: none;
     opacity: 1; /* Still there, just no shadow */
   }
   ```

2. **SVG Filter Definitions - Topological Variation**
   ```xml
   <!-- Depression (inset into paper) -->
   <filter id="shadow-depression">
     <!-- Inner shadow (top-left dark) -->
     <feDropShadow dx="-2" dy="-2" stdDeviation="3" flood-opacity="0.3"/>
     <!-- Outer highlight (bottom-right light) -->
     <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.7" flood-color="white"/>
   </filter>
   
   <!-- Extrusion (raised from paper) -->
   <filter id="shadow-extrusion">
     <!-- Outer shadow (bottom-right dark) -->
     <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.2"/>
     <!-- Inner highlight (top-left light) -->
     <feDropShadow dx="-1" dy="-1" stdDeviation="2" flood-opacity="0.8" flood-color="white"/>
   </filter>
   
   <!-- Faint depression for ring 1 quiet state -->
   <filter id="shadow-faint-depression">
     <feDropShadow dx="-1" dy="-1" stdDeviation="3" flood-opacity="0.05"/>
     <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.15" flood-color="white"/>
   </filter>
   
   <!-- Mixed topology for variation -->
   <filter id="shadow-shallow">
     <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.15"/>
     <feDropShadow dx="-0.5" dy="-0.5" stdDeviation="1" flood-opacity="0.4" flood-color="white"/>
   </filter>
   ```

3. **No Stroke Policy**
   - All paths: `stroke="none"`
   - Edge definition comes from shadows only
   - Fill always matches background

## Probability Distribution Model

### Ring-Based Probability
```javascript
const ringProbabilities = {
  0: 1.00,  // Center: always visible
  1: 0.95,  // Ring 1: almost always visible
  2: 0.75,  // Ring 2: mostly visible
  3: 0.50,  // Ring 3: half visible
  4: 0.25,  // Ring 4: sparse
  5: 0.10   // Ring 5: very sparse
};

// Amplitude modulation
const adjustedProbability = baseProbability * (amplitude / 100);
```

### Selection Algorithm
```javascript
function selectVisibleHexagons(ring, amplitude) {
  const baseProbability = ringProbabilities[ring];
  const adjustedProb = Math.min(1, baseProbability * (amplitude / 50));
  
  return hexagonsInRing.map(hex => ({
    ...hex,
    isVisible: Math.random() < adjustedProb,
    topology: Math.random() > 0.5 ? 'depression' : 'extrusion' // Random topology
  }));
}
```

### Topological Distribution
```javascript
// Different topology patterns for variety
const topologyPatterns = {
  uniform: () => 'extrusion', // All raised
  alternating: (index) => index % 2 ? 'depression' : 'extrusion',
  random: () => Math.random() > 0.5 ? 'depression' : 'extrusion',
  radial: (ring) => ring < 3 ? 'extrusion' : 'depression', // Inner raised, outer depressed
  wave: (index, ring) => {
    // Create wave pattern across the grid
    const phase = (index + ring * 2) * 0.5;
    return Math.sin(phase) > 0 ? 'extrusion' : 'depression';
  }
};
```

### Chaos Characteristics
- **Inner rings**: Consistent, predictable
- **Outer rings**: Increasing randomness
- **Amplitude scaling**: Louder = more hexagons appear
- **Temporal stability**: Once selected, hexagons stay for minimum duration

## Initial State Specification

### Quiet State
- **Center hexagon (ring 0)**: Fully visible with normal shadow
- **First ring (ring 1)**: Faint shadow - just a hint of presence
- **Outer rings (2-5)**: No shadow - completely invisible
- **Appearance**: Center hexagon with subtle indication of surrounding structure

### Sound Activation
1. First sound: Ring 1 transitions from faint to full shadow (high probability all 6 show)
2. Louder: Rings 2-3 activate (some missing hexagons)
3. Very loud: Rings 4-5 partially activate (sparse, chaotic)

## Technical Requirements

### SVG Structure
```xml
<svg viewBox="0 0 800 700" class="hexagon-grid">
  <defs>
    <filter id="shadow-visible">...</filter>
    <!-- No shadow filter needed for invisible -->
  </defs>
  
  <!-- All 91 hexagons always present -->
  <g class="hexagon-container">
    {hexagons.map(hex => (
      <path
        key={hex.id}
        d={hex.pathData}
        fill="var(--color-bg-primary)"
        stroke="none"
        filter={hex.isVisible ? "url(#shadow-visible)" : "none"}
        class={`hexagon ring-${hex.ring}`}
      />
    ))}
  </g>
</svg>
```

### Performance Considerations
- All hexagons rendered once (no DOM manipulation)
- Only filter attribute changes
- CSS transitions for smooth shadow appearance
- No position recalculations

## Implementation Steps

1. **Fix mathematical positioning** for perfect alignment
2. **Remove all movement animations**
3. **Implement shadow-based visibility**
4. **Add probability selection logic**
5. **Test with various amplitude levels**
6. **Optimize performance**

## Success Criteria

- [ ] Perfect hexagon alignment - all edges touch
- [ ] Zero movement - completely static grid
- [ ] Shadow-only visibility (no borders)
- [ ] Smooth shadow transitions
- [ ] Probability-based ring activation
- [ ] Quiet state shows only center hexagon
- [ ] Performance: 60fps with all transitions

## Notes

- The grid is like a sheet of paper with hexagonal indentations
- Shadows make indentations visible
- No shadow = hexagon blends with background
- Think of it as a static relief map where light changes reveal topology