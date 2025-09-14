#!/usr/bin/env node

/**
 * Memory MCP Initialization Script
 * Automatically captures and stores project knowledge
 */

const memoryPatterns = {
  // When starting a new feature
  newFeature: (name, description, techStack) => ({
    context: "alphanumeric",
    entities: [{
      name: name,
      entityType: "feature",
      observations: [
        `Description: ${description}`,
        `Tech stack: ${techStack}`,
        `Created: ${new Date().toISOString()}`,
        "Status: In Development"
      ]
    }]
  }),

  // When fixing a bug
  bugFix: (bugId, description, solution, affectedComponent) => ({
    context: "alphanumeric",
    entities: [{
      name: `Bug_${bugId}`,
      entityType: "bug",
      observations: [
        `Problem: ${description}`,
        `Solution: ${solution}`,
        `Component: ${affectedComponent}`,
        `Fixed: ${new Date().toISOString()}`
      ]
    }]
  }),

  // When making architectural decisions
  decision: (name, reasoning, alternatives, outcome) => ({
    context: "alphanumeric",
    entities: [{
      name: name,
      entityType: "decision",
      observations: [
        `Reasoning: ${reasoning}`,
        `Alternatives considered: ${alternatives}`,
        `Outcome: ${outcome}`,
        `Date: ${new Date().toISOString()}`
      ]
    }]
  }),

  // When discovering performance insights
  performance: (component, metric, improvement, technique) => ({
    context: "alphanumeric",
    entities: [{
      name: `Perf_${component}`,
      entityType: "optimization",
      observations: [
        `Metric: ${metric}`,
        `Improvement: ${improvement}`,
        `Technique: ${technique}`,
        `Date: ${new Date().toISOString()}`
      ]
    }]
  }),

  // When integrating new dependencies
  dependency: (name, version, purpose, configNotes) => ({
    context: "alphanumeric",
    entities: [{
      name: name,
      entityType: "dependency",
      observations: [
        `Version: ${version}`,
        `Purpose: ${purpose}`,
        `Configuration: ${configNotes}`,
        `Added: ${new Date().toISOString()}`
      ]
    }]
  }),

  // When encountering gotchas or edge cases
  gotcha: (component, issue, solution, preventionTips) => ({
    context: "alphanumeric",
    entities: [{
      name: `Gotcha_${component}`,
      entityType: "gotcha",
      observations: [
        `Issue: ${issue}`,
        `Solution: ${solution}`,
        `Prevention: ${preventionTips}`,
        `Discovered: ${new Date().toISOString()}`
      ]
    }]
  })
};

// Example usage patterns to show in console
const examples = {
  feature: `
// Capture new feature:
aim_create_entities(memoryPatterns.newFeature(
  "VoiceCommandPalette",
  "Command palette triggered by voice",
  "Svelte, Web Speech API, Fuse.js"
))`,
  
  bug: `
// Record bug fix:
aim_create_entities(memoryPatterns.bugFix(
  "101",
  "Voice recognition fails in noisy environment",
  "Added noise suppression and confidence threshold",
  "VoiceTerminal"
))`,

  decision: `
// Document architectural decision:
aim_create_entities(memoryPatterns.decision(
  "StateManagement",
  "Needed reactive state across components",
  "Redux, MobX, Svelte stores",
  "Chose Svelte stores for simplicity"
))`,

  performance: `
// Log performance improvement:
aim_create_entities(memoryPatterns.performance(
  "FlexibleTerminal",
  "Render time",
  "Reduced by 60%",
  "Virtual scrolling + memoization"
))`,

  relation: `
// Connect entities:
aim_create_relations({
  context: "alphanumeric",
  relations: [{
    from: "VoiceCommandPalette",
    to: "VoiceTerminalHybrid",
    relationType: "extends"
  }]
})`
};

// Display usage guide
console.log("🧠 Memory MCP Pattern Library");
console.log("==============================\n");
console.log("Copy these patterns into Claude to capture project knowledge:\n");

Object.entries(examples).forEach(([type, example]) => {
  console.log(`\n${type.toUpperCase()}:`);
  console.log(example);
});

console.log("\n💡 Quick Commands:");
console.log("- Search all: aim_search_nodes({context: 'alphanumeric', query: 'your_search'})");
console.log("- View graph: aim_read_graph({context: 'alphanumeric'})");
console.log("- List databases: aim_list_databases()");

module.exports = memoryPatterns;