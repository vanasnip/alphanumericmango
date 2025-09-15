# Launch FE Clusters for Component Development

## Setup Complete! ✅

The component library infrastructure is ready. Now we need to launch multiple FE clusters to build components in parallel.

## How to Launch Each Cluster

For each component, launch a new FE cluster with this prompt:

### Cluster 1: Paper Component
```
You are FE Cluster 1. Your task is to build the Paper component for the Voice Terminal component library.

Location: voice-terminal-components/src/components/Paper/

Requirements:
- Create a neumorphic container component with elevation variants (raised/recessed/flat)
- Support all spacing sizes from the design tokens
- Make it theme-aware (light/dark modes)
- Ensure full accessibility

Files to create:
1. Paper.tsx - Main component
2. Paper.test.tsx - Unit tests with >80% coverage
3. Paper.stories.tsx - Storybook stories showing all variants
4. Paper.module.css - Component styles
5. index.ts - Exports

Use the design tokens from src/theme/tokens.ts
Follow the Paper theme aesthetic from voice-terminal-ui-improvements.md
Ensure all tests pass before marking complete
```

### Cluster 2: Typography Component
```
You are FE Cluster 2. Your task is to build the Typography component for the Voice Terminal component library.

Location: voice-terminal-components/src/components/Typography/

Requirements:
- Create text component with variants (heading/body/caption)
- Support all font weights and sizes from design tokens
- Allow switching between mono and sans-serif fonts
- Use semantic HTML elements based on variant

Files to create:
1. Typography.tsx - Main component
2. Typography.test.tsx - Unit tests with >80% coverage
3. Typography.stories.tsx - Storybook stories
4. Typography.module.css - Component styles
5. index.ts - Exports

Use the design tokens from src/theme/tokens.ts
Ensure all tests pass before marking complete
```

### Cluster 3: Button Component
```
You are FE Cluster 3. Your task is to build the Button component for the Voice Terminal component library.

Location: voice-terminal-components/src/components/Button/

Requirements:
- Create neumorphic button with variants (primary/secondary/ghost)
- Support size options (sm/md/lg)
- Implement loading and disabled states
- Add icon support

Files to create:
1. Button.tsx - Main component
2. Button.test.tsx - Unit tests with >80% coverage
3. Button.stories.tsx - Storybook stories
4. Button.module.css - Component styles
5. index.ts - Exports

Use the design tokens from src/theme/tokens.ts
Follow the neumorphic Paper theme aesthetic
Ensure all tests pass before marking complete
```

### Cluster 4: MessageBubble Component
```
You are FE Cluster 4. Your task is to build the MessageBubble component for the Voice Terminal component library.

Location: voice-terminal-components/src/components/MessageBubble/

Requirements:
- Different shapes: pill for user, rounded rectangle for agent
- Support avatars and timestamps
- Show model badges for AI messages
- Theme-aware colors

Files to create:
1. MessageBubble.tsx - Main component
2. MessageBubble.test.tsx - Unit tests with >80% coverage
3. MessageBubble.stories.tsx - Storybook stories
4. MessageBubble.module.css - Component styles
5. index.ts - Exports

Reference the chat bubble design from voice-terminal-ui-improvements.md
Use the design tokens from src/theme/tokens.ts
Ensure all tests pass before marking complete
```

## Testing Each Component

After each cluster completes their component:

1. Install dependencies (if not done):
```bash
cd voice-terminal-components
npm install
```

2. Run tests:
```bash
npm test
```

3. Check coverage:
```bash
npm run test:coverage
```

4. View in Storybook:
```bash
npm run storybook
```

## Integration Checklist

As each component is completed:

- [ ] Paper component complete with tests
- [ ] Typography component complete with tests  
- [ ] Button component complete with tests
- [ ] MessageBubble component complete with tests
- [ ] HexagonGrid component complete with tests
- [ ] TabBar component complete with tests
- [ ] TextField component complete with tests
- [ ] ProjectCard component complete with tests

## Next Steps

1. Launch FE clusters for first 4 components
2. Test each component as it's completed
3. Update src/index.ts to export completed components
4. Launch next batch of clusters for remaining components
5. Create integration tests
6. Build and publish library

---

*Ready to launch parallel FE clusters!*