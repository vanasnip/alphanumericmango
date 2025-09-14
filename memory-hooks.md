# Memory Hooks for Development Workflow

## Automatic Memory Capture Points

### 1. Git Commit Hooks
When you commit, Claude should capture:
```javascript
// After each commit
aim_add_observations({
  context: "alphanumeric",
  observations: [{
    entityName: "AlphanumericMango",
    contents: [`Commit: ${commitMessage}`, `Files changed: ${filesChanged}`]
  }]
})
```

### 2. Error Resolution Tracking
When Claude fixes an error:
```javascript
// Automatically capture error solutions
aim_create_entities({
  context: "alphanumeric",
  entities: [{
    name: `Error_${Date.now()}`,
    entityType: "error",
    observations: [
      `Error: ${errorMessage}`,
      `File: ${fileName}:${lineNumber}`,
      `Solution: ${solutionApplied}`,
      `Root cause: ${rootCause}`
    ]
  }]
})
```

### 3. Code Review Insights
During code reviews:
```javascript
// Capture review feedback
aim_create_entities({
  context: "alphanumeric",
  entities: [{
    name: "Review_" + reviewId,
    entityType: "review",
    observations: [
      `Pattern identified: ${pattern}`,
      `Improvement: ${suggestion}`,
      `Impact: ${impact}`
    ]
  }]
})
```

### 4. Testing Discoveries
When tests reveal insights:
```javascript
// Store test insights
aim_add_observations({
  context: "alphanumeric",
  observations: [{
    entityName: componentName,
    contents: [
      `Test coverage: ${coverage}%`,
      `Edge case found: ${edgeCase}`,
      `Performance baseline: ${metric}`
    ]
  }]
})
```

## Memory Query Patterns

### Quick Searches
```javascript
// "What did we decide about state management?"
aim_search_nodes({context: "alphanumeric", query: "state management decision"})

// "Show all performance improvements"
aim_search_nodes({context: "alphanumeric", query: "performance optimization"})

// "What bugs affected the voice terminal?"
aim_search_nodes({context: "alphanumeric", query: "bug VoiceTerminal"})

// "List all architectural decisions"
aim_search_nodes({context: "alphanumeric", query: "entityType:decision"})
```

### Relationship Queries
```javascript
// "What components use MCP?"
aim_open_nodes({context: "alphanumeric", names: ["MCPArchitecture"]})
// Then check incoming relations

// "What features are part of VoiceTerminal?"
aim_read_graph({context: "alphanumeric"})
// Filter for relations where to="VoiceTerminalHybrid"
```

## Integration Instructions for Claude

When working on this project, Claude should:

1. **Start each session** by checking memory:
   ```javascript
   aim_search_nodes({context: "alphanumeric", query: relevantKeywords})
   ```

2. **After solving problems**, store the solution:
   ```javascript
   aim_add_observations({...})
   ```

3. **When making decisions**, create decision entities:
   ```javascript
   aim_create_entities({entityType: "decision", ...})
   ```

4. **Before implementing features**, check for related knowledge:
   ```javascript
   aim_search_nodes({query: featureName})
   ```

5. **After discovering gotchas**, document them:
   ```javascript
   aim_create_entities({entityType: "gotcha", ...})
   ```

## Memory Contexts Strategy

- **alphanumeric**: Main project context (default)
- **alphanumeric-experiments**: For experimental features
- **alphanumeric-performance**: Performance-specific insights
- **alphanumeric-architecture**: Architectural decisions and patterns
- **alphanumeric-bugs**: Bug tracking and solutions