# Memory MCP Usage Guide

## Why Memory MCP Matters

Traditional AI assistants reset with each conversation. Memory MCP changes that by giving Claude persistent knowledge about your project that grows over time.

### Real Benefits You'll Experience

1. **No More Repetition**: Claude remembers your architectural decisions, bug fixes, and optimizations
2. **Contextual Intelligence**: Claude understands YOUR codebase's specific patterns and gotchas
3. **Knowledge Accumulation**: Every problem solved adds to the project's collective intelligence
4. **Team Knowledge Sharing**: New developers can query the project's history instantly

## Quick Start

### 1. Check What Claude Knows
```javascript
// See everything about your project
aim_read_graph({context: "alphanumeric"})

// Search for specific knowledge
aim_search_nodes({context: "alphanumeric", query: "voice terminal"})
```

### 2. Teach Claude About Your Work
```javascript
// When you make a decision
aim_create_entities({
  context: "alphanumeric",
  entities: [{
    name: "StateManagementChoice",
    entityType: "decision",
    observations: [
      "Chose Svelte stores over Redux",
      "Reason: Simpler, built-in reactivity",
      "Date: 2024-01-15"
    ]
  }]
})

// When you fix a bug
aim_create_entities({
  context: "alphanumeric",
  entities: [{
    name: "Bug_VoiceRecognition",
    entityType: "bug",
    observations: [
      "Problem: Voice commands failed in Chrome",
      "Solution: Added webkit prefix for Speech API",
      "Affected: VoiceTerminal component"
    ]
  }]
})
```

### 3. Connect Knowledge
```javascript
// Show relationships
aim_create_relations({
  context: "alphanumeric",
  relations: [{
    from: "Bug_VoiceRecognition",
    to: "VoiceTerminalHybrid",
    relationType: "affected"
  }]
})
```

## Memory Contexts

- **alphanumeric**: Main project knowledge
- **alphanumeric-architecture**: Design patterns and decisions
- **alphanumeric-performance**: Optimization insights
- **alphanumeric-bugs**: Issue tracking and solutions
- **alphanumeric-experiments**: Experimental features

## Practical Workflows

### Starting a Coding Session
```javascript
// Claude should first check relevant memory
aim_search_nodes({context: "alphanumeric", query: "current feature keywords"})
```

### After Solving a Problem
```javascript
// Claude should store the solution
aim_add_observations({
  context: "alphanumeric",
  observations: [{
    entityName: "ComponentName",
    contents: ["Solution details", "Performance impact"]
  }]
})
```

### Before Major Changes
```javascript
// Check historical decisions
aim_search_nodes({context: "alphanumeric", query: "architecture decisions"})
```

## Shell Shortcuts

Source the shortcuts file:
```bash
source scripts/memory-shortcuts.sh
```

Then use:
- `mem-search "voice"` - Search for voice-related knowledge
- `mem-graph` - View entire knowledge graph
- `mem-bugs "terminal"` - Find bugs related to terminal
- `mem-decisions` - List all architectural decisions

## Example: Complete Feature Development with Memory

```javascript
// 1. Check if similar feature exists
aim_search_nodes({context: "alphanumeric", query: "command palette"})

// 2. Create feature entity
aim_create_entities({
  context: "alphanumeric",
  entities: [{
    name: "CommandPalette",
    entityType: "feature",
    observations: ["Keyboard-driven navigation", "Uses Fuse.js for fuzzy search"]
  }]
})

// 3. Link to parent module
aim_create_relations({
  context: "alphanumeric",
  relations: [{
    from: "CommandPalette",
    to: "VoiceTerminalHybrid",
    relationType: "part_of"
  }]
})

// 4. Document learnings
aim_add_observations({
  context: "alphanumeric",
  observations: [{
    entityName: "CommandPalette",
    contents: ["Performance: 16ms render time", "Accessibility: ARIA compliant"]
  }]
})
```

## Best Practices

1. **Be Consistent**: Use the same entity names across sessions
2. **Be Specific**: Include file paths, line numbers, and metrics
3. **Be Timely**: Capture knowledge immediately while context is fresh
4. **Be Connected**: Create relations to show how components interact
5. **Be Searchable**: Use keywords that you'll remember later

## Troubleshooting

- **Can't find information?** Try broader search terms
- **Too much information?** Use specific contexts (architecture, performance, etc.)
- **Memory not persisting?** Check `.aim/` directory exists in project root

## Integration with Development

The Memory MCP transforms Claude from a stateless assistant into your project's living knowledge base. Every conversation builds on the last, creating compound learning that makes development progressively more efficient.

Use it to:
- Onboard new team members instantly
- Never lose track of why decisions were made
- Build on previous solutions instead of reinventing
- Create self-documenting codebases
- Maintain institutional knowledge even as team changes