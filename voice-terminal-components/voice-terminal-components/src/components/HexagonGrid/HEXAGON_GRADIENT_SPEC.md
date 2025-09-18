# Hexagon Fill Gradient Specification

## Overview
This document specifies the gradient distribution system for individual hexagon fill colors in the HexagonGrid component. The design creates subtle, sophisticated gradients where most of the hexagon surface matches the background, with gentle transitions to shadow and light areas.

## Gradient Distribution Model

### Primary Distribution (Percentage of Hexagon Surface)
```
┌─────────────────────────────────────────┐
│                                         │
│     Shadow Side    →    Light Side     │
│                                         │
│  [20%] [7.5%] [  60%  ] [7.5%] [5%]   │
│    ↑      ↑       ↑        ↑     ↑     │
│  Dark  Trans   Base    Trans  Light    │
│                                         │
└─────────────────────────────────────────┘
```

### Detailed Zone Breakdown
- **20% Shadow Zone**: Darker gradient area on shadow side
- **7.5% Shadow Transition**: Gradual blend from shadow to base
- **60% Base Zone**: Matches background color exactly
- **7.5% Light Transition**: Gradual blend from base to light
- **5% Light Zone**: Subtle highlight on light side

## Gradient Implementation Strategy

### 1. Linear Gradient Approach
For hexagons with directional lighting (simulating light from top-right):

```svg
<linearGradient id="hexagon-fill-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
  <!-- Shadow side (bottom-left) -->
  <stop offset="0%" stop-color="var(--shadow-color)" stop-opacity="1"/>
  <stop offset="20%" stop-color="var(--shadow-color)" stop-opacity="1"/>
  
  <!-- Shadow transition zone -->
  <stop offset="27.5%" stop-color="var(--bg-color)" stop-opacity="1"/>
  
  <!-- Base color zone (matches background) -->
  <stop offset="27.5%" stop-color="var(--bg-color)" stop-opacity="1"/>
  <stop offset="87.5%" stop-color="var(--bg-color)" stop-opacity="1"/>
  
  <!-- Light transition zone -->
  <stop offset="95%" stop-color="var(--light-color)" stop-opacity="1"/>
  
  <!-- Light side (top-right) -->
  <stop offset="100%" stop-color="var(--light-color)" stop-opacity="1"/>
</linearGradient>
```

### 2. Radial Gradient Approach (Alternative)
For hexagons with center-focused elevation effects:

```svg
<radialGradient id="hexagon-fill-radial" cx="50%" cy="50%" r="50%">
  <!-- Center matches background -->
  <stop offset="0%" stop-color="var(--bg-color)" stop-opacity="1"/>
  <stop offset="60%" stop-color="var(--bg-color)" stop-opacity="1"/>
  
  <!-- Transition zone -->
  <stop offset="75%" stop-color="var(--bg-color)" stop-opacity="0.98"/>
  
  <!-- Edge variations -->
  <stop offset="85%" stop-color="var(--shadow-color)" stop-opacity="0.05"/>
  <stop offset="100%" stop-color="var(--light-color)" stop-opacity="0.02"/>
</radialGradient>
```

## Color Values

### CSS Custom Properties
```css
:root {
  /* Base color - matches background exactly */
  --hexagon-bg-color: var(--color-bg-primary, #ffffff);
  
  /* Shadow color - slightly darker than background */
  --hexagon-shadow-color: rgba(0, 0, 0, 0.08); /* 8% black overlay */
  
  /* Light color - barely lighter than background */
  --hexagon-light-color: rgba(255, 255, 255, 0.05); /* 5% white overlay */
  
  /* Transition smoothness */
  --hexagon-gradient-smoothness: 0.5; /* 0 = sharp, 1 = smooth */
}
```

### Dark Mode Adjustments
```css
[data-theme="dark"] {
  /* Inverted for dark themes */
  --hexagon-shadow-color: rgba(0, 0, 0, 0.12); /* Deeper shadows */
  --hexagon-light-color: rgba(255, 255, 255, 0.03); /* Subtler highlights */
}
```

## Implementation Requirements

### 1. Gradient Types by Hexagon State
Different hexagon states should use variations of the base gradient:

| State | Shadow % | Base % | Light % | Notes |
|-------|----------|--------|---------|-------|
| Flat | 20% | 60% | 5% | Standard distribution |
| Depressed | 25% | 55% | 5% | More shadow for depth |
| Elevated | 15% | 60% | 10% | More light for height |
| Crater | 30% | 50% | 5% | Heavy shadow in depression |
| Hole | 35% | 45% | 5% | Deepest shadow effect |

### 2. Ring-Based Variations
Hexagons in different rings should have subtle variations:

- **Center (Ring 0)**: Full gradient intensity
- **Ring 1**: 80% gradient intensity (closer to flat)
- **Ring 2**: 60% gradient intensity  
- **Ring 3+**: 40% gradient intensity (nearly flat)

### 3. Animation Considerations
When hexagons animate (amplitude changes), gradients should:
- Maintain consistent direction
- Smoothly transition intensity based on elevation
- Never flip or rotate suddenly

## Technical Implementation

### Component Props
```typescript
interface HexagonGradientProps {
  gradientDistribution?: {
    shadow: number;      // Default: 20
    shadowTransition: number; // Default: 7.5
    base: number;        // Default: 60
    lightTransition: number;  // Default: 7.5
    light: number;       // Default: 5
  };
  gradientDirection?: 'linear' | 'radial'; // Default: 'linear'
  gradientAngle?: number; // Default: 45 (degrees, for linear)
}
```

### Gradient Generation Function
```typescript
function generateHexagonGradient(config: HexagonGradientProps) {
  const { 
    shadow = 20, 
    shadowTransition = 7.5,
    base = 60,
    lightTransition = 7.5,
    light = 5 
  } = config.gradientDistribution || {};
  
  // Calculate stop positions
  const stops = {
    shadowEnd: shadow,
    baseStart: shadow + shadowTransition,
    baseEnd: shadow + shadowTransition + base,
    lightStart: shadow + shadowTransition + base + lightTransition,
    lightEnd: 100
  };
  
  // Generate gradient string
  return `...gradient definition...`;
}
```

## Visual Examples

### Standard Hexagon (60-20-5 Distribution)
```
     ╱◹◹◹◹◹◹╲
   ╱◹◹░░░░░░◹╲
  │◹░░░░░░░░░│
  │░░░░░░░░░░│
   ╲░░░░░░░░╱
     ╲░░░░╱

Legend: ◹ = shadow, ░ = base (background), ◦ = light
```

### Elevated Hexagon (60-15-10 Distribution)
```
     ╱◦◦◦◦◦◦╲
   ╱◦◦░░░░░░◦╲
  │◦░░░░░░░░◦│
  │░░░░░░░░░░│
   ╲◹░░░░░░◹╱
     ╲◹◹◹◹╱
```

## Testing & Validation

### Storybook Stories Required
1. **Gradient Distribution Control**: Interactive sliders for each zone percentage
2. **Direction Toggle**: Switch between linear and radial gradients
3. **Theme Testing**: Validate appearance in light/dark modes
4. **Animation Preview**: Show gradient behavior during amplitude changes
5. **Ring Variation Display**: Show gradient intensity by ring position

### Acceptance Criteria
- [ ] Base zone visually matches background color
- [ ] Shadow zone is subtle (not overpowering)
- [ ] Light zone is barely perceptible
- [ ] Transitions are smooth and natural
- [ ] No harsh edges or color bands
- [ ] Works with all amplitude states
- [ ] Maintains visual hierarchy (center more dramatic than edges)

## Next Steps

1. **Implement gradient definitions** in HexagonGrid component
2. **Add gradient distribution props** to component interface  
3. **Create Storybook story** for gradient testing
4. **Fine-tune color values** based on visual testing
5. **Document final values** in component README

---

*Created: 2025-01-17*  
*Status: Ready for Implementation*  
*Version: 1.0.0*