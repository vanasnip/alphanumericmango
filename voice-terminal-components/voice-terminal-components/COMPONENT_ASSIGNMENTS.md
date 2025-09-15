# Component Development Assignments for FE Clusters

## Parallel Development Strategy

Each FE cluster will develop one component with full unit tests. Components are ordered by dependency - foundational components first.

## Phase 1: Foundation Components (Critical Path)

### Cluster 1: Paper Component
**Component**: `src/components/Paper/`
**Priority**: HIGHEST - All other components depend on this
**Requirements**:
- Neumorphic container with elevation variants (raised/recessed/flat)
- Support for all spacing sizes
- Theme-aware (light/dark)
- Fully accessible

**Tests Required**:
- Renders with all elevation variants
- Applies correct shadows for theme
- Handles padding props correctly
- Accessibility: proper ARIA roles

**Files to Create**:
- `Paper.tsx` - Component
- `Paper.test.tsx` - Unit tests
- `Paper.stories.tsx` - Storybook stories
- `Paper.module.css` - Styles
- `index.ts` - Exports

---

### Cluster 2: Typography Component
**Component**: `src/components/Typography/`
**Priority**: HIGHEST - Used by all text content
**Requirements**:
- Text component with variants (heading/body/caption)
- Support for all font weights and sizes
- Mono vs sans-serif option
- Semantic HTML elements

**Tests Required**:
- Renders correct HTML element based on variant
- Applies correct styles for each variant
- Handles color props
- Supports polymorphic "as" prop

**Files to Create**:
- `Typography.tsx` - Component
- `Typography.test.tsx` - Unit tests
- `Typography.stories.tsx` - Storybook stories
- `Typography.module.css` - Styles
- `index.ts` - Exports

---

### Cluster 3: Button Component
**Component**: `src/components/Button/`
**Priority**: HIGH - Core interactive element
**Requirements**:
- Neumorphic button with variants (primary/secondary/ghost)
- Size options (sm/md/lg)
- Loading state
- Disabled state
- Icon support

**Tests Required**:
- Renders all variants correctly
- Handles click events
- Shows loading spinner when loading
- Disabled state prevents clicks
- Keyboard navigation works

**Files to Create**:
- `Button.tsx` - Component
- `Button.test.tsx` - Unit tests
- `Button.stories.tsx` - Storybook stories
- `Button.module.css` - Styles
- `index.ts` - Exports

---

## Phase 2: Feature Components

### Cluster 4: MessageBubble Component
**Component**: `src/components/MessageBubble/`
**Priority**: HIGH - Core chat feature
**Requirements**:
- Different shapes for user (pill) vs agent (rounded rectangle)
- Avatar support
- Timestamp display
- Model badge for AI messages
- Theme-aware colors

**Tests Required**:
- Renders user messages with pill shape
- Renders agent messages with rectangle shape
- Displays avatar when provided
- Shows timestamp correctly
- Displays model badge for AI

**Files to Create**:
- `MessageBubble.tsx` - Component
- `MessageBubble.test.tsx` - Unit tests
- `MessageBubble.stories.tsx` - Storybook stories
- `MessageBubble.module.css` - Styles
- `index.ts` - Exports

---

### Cluster 5: HexagonGrid Component
**Component**: `src/components/HexagonGrid/`
**Priority**: MEDIUM - Voice indicator feature
**Requirements**:
- Dynamic hexagon grid based on amplitude
- Shadow-based animation
- Smooth transitions
- Optional color pulse effect
- Performance optimized

**Tests Required**:
- Renders single hexagon at rest
- Expands grid based on amplitude prop
- Applies correct shadows
- Smooth animation transitions
- Handles rapid amplitude changes

**Files to Create**:
- `HexagonGrid.tsx` - Component
- `Hexagon.tsx` - Individual hexagon
- `HexagonGrid.test.tsx` - Unit tests
- `HexagonGrid.stories.tsx` - Storybook stories
- `HexagonGrid.module.css` - Styles
- `index.ts` - Exports

---

### Cluster 6: TabBar Component
**Component**: `src/components/TabBar/`
**Priority**: HIGH - Navigation
**Requirements**:
- Seamless connection to content
- Active tab indicator (bottom border)
- Smooth transitions
- Keyboard navigation
- Close button on tabs

**Tests Required**:
- Renders all tabs
- Shows active tab correctly
- Handles tab click events
- Keyboard navigation (arrow keys)
- Close button triggers callback

**Files to Create**:
- `TabBar.tsx` - Component
- `Tab.tsx` - Individual tab
- `TabBar.test.tsx` - Unit tests
- `TabBar.stories.tsx` - Storybook stories
- `TabBar.module.css` - Styles
- `index.ts` - Exports

---

### Cluster 7: TextField Component
**Component**: `src/components/TextField/`
**Priority**: HIGH - User input
**Requirements**:
- Recessed paper appearance
- Placeholder support
- Clear button
- Error state
- Multi-line support

**Tests Required**:
- Renders with recessed style
- Handles input changes
- Shows/hides clear button
- Displays error state
- Supports textarea mode

**Files to Create**:
- `TextField.tsx` - Component
- `TextField.test.tsx` - Unit tests
- `TextField.stories.tsx` - Storybook stories
- `TextField.module.css` - Styles
- `index.ts` - Exports

---

### Cluster 8: ProjectCard Component
**Component**: `src/components/ProjectCard/`
**Priority**: MEDIUM - Project management
**Requirements**:
- Neumorphic card design
- Color coding bottom border
- Icon support
- Title and description
- Hover state

**Tests Required**:
- Renders with project color
- Displays title and description
- Shows icon when provided
- Hover state changes elevation
- Click event handling

**Files to Create**:
- `ProjectCard.tsx` - Component
- `ProjectCard.test.tsx` - Unit tests
- `ProjectCard.stories.tsx` - Storybook stories
- `ProjectCard.module.css` - Styles
- `index.ts` - Exports

---

## Testing Standards

### Every Component Must Have:

1. **Unit Tests** (minimum 80% coverage)
```typescript
describe('ComponentName', () => {
  it('renders without crashing', () => {});
  it('applies correct styles for variant', () => {});
  it('handles user interactions', () => {});
  it('is accessible', () => {});
});
```

2. **Storybook Stories**
```typescript
export default {
  title: 'Components/ComponentName',
  component: ComponentName,
};

export const Default = {};
export const AllVariants = {};
export const Interactive = {};
```

3. **Type Safety**
```typescript
interface ComponentProps {
  // Full TypeScript interfaces
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}
```

4. **Accessibility**
- Proper ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast compliance

## Coordination Protocol

1. Each cluster works independently on their component
2. Use the design tokens from `src/theme/tokens.ts`
3. Follow the Paper theme aesthetic
4. Ensure all tests pass before marking complete
5. Create PR for review when done

## Success Criteria

- [ ] Component renders correctly
- [ ] All unit tests pass (>80% coverage)
- [ ] Storybook story demonstrates all features
- [ ] TypeScript types are complete
- [ ] Accessibility requirements met
- [ ] Follows design system guidelines
- [ ] Code is well-documented

---

*Ready to assign to FE clusters for parallel development*