# .claude Directory - Cross-Project Shared Resources

## Persona Mode Commands

### Quick Commands
- **`/p`**: Show all available agents or switch to a specific agent persona
- **`/p [agent-name]`**: Switch to a specific agent persona (e.g., `/p frontend`)
- **`ag -p`**: Enter agent persona mode (list all available agents)
- **`ag [agent-name] -p`**: Switch directly to that agent's persona mode
- **`[agent-name] -p`**: Alternative syntax to activate persona mode for an agent
- **`teams -p`**: Enter teams persona mode (list all available team configurations)

The `-p` flag stands for **persona** mode, which allows Claude to adopt the behavioral directives and expertise of specific agents or teams.

### Persona Mode Activation Patterns
All these commands activate persona mode for the frontend agent:
- `/p frontend` - Direct persona command
- `ag frontend -p` - Via ag command with persona flag
- `ag -p frontend` - Alternative ag syntax
- `frontend -p` - Direct agent name with persona flag

Once in persona mode, Claude adopts the agent's:
- Behavioral directives and expertise
- Domain-specific knowledge and approach
- Communication style and priorities
- Tool access restrictions

## Memory MCP (Knowledge Graph) Usage

### Overview
This project uses the MCP Knowledge Graph for persistent memory across conversations. The memory system stores entities, relations, and observations in a local knowledge graph.

### Key Commands

#### Creating Entities
```javascript
// Add project entities
aim_create_entities({
  context: "work",  // Optional: use contexts like "work", "personal", "research"
  entities: [{
    name: "ProjectName",
    entityType: "project",
    observations: ["Key feature", "Deadline", "Tech stack"]
  }]
})
```

#### Creating Relations
```javascript
// Link entities together
aim_create_relations({
  context: "work",
  relations: [{
    from: "Developer",
    to: "ProjectName",
    relationType: "works_on"
  }]
})
```

#### Searching Memory
```javascript
// Find relevant information
aim_search_nodes({
  context: "work",  // Optional: search specific context
  query: "electron"
})
```

#### Adding Observations
```javascript
// Update existing entities
aim_add_observations({
  context: "work",
  observations: [{
    entityName: "ProjectName",
    contents: ["New requirement added", "Performance improved"]
  }]
})
```

### Storage Organization

#### Contexts (Databases)
- **Master** (default): General cross-project information
- **work**: Professional projects and tasks
- **personal**: Personal notes and reminders
- **research**: Technical research and discoveries
- Create any context name as needed

#### Storage Locations
- **Project-local**: `.aim/` directory in project root (preferred for project-specific memory)
- **Global**: Configured directory for cross-project memory
- Use `location: "project"` or `location: "global"` to override

### Best Practices

1. **Use Consistent Contexts**: Stick to simple names like "work" rather than variations
2. **Project Memory**: Store project-specific knowledge in project context
3. **Entity Types**: Common types include:
   - `person`, `project`, `feature`, `bug`, `meeting`, `decision`, `technology`
4. **Relations**: Use active voice (e.g., "manages", "uses", "depends_on")
5. **Regular Updates**: Add observations as projects evolve

### Example Workflow

```javascript
// 1. Initialize project memory
aim_create_entities({
  context: "alphanumeric",
  entities: [
    {name: "AlphanumericMango", entityType: "project", observations: ["Multi-project workspace", "Uses Electron and Svelte"]},
    {name: "VoiceTerminal", entityType: "feature", observations: ["Voice-controlled UI", "MCP architecture"]}
  ]
})

// 2. Create relationships
aim_create_relations({
  context: "alphanumeric",
  relations: [
    {from: "VoiceTerminal", to: "AlphanumericMango", relationType: "part_of"}
  ]
})

// 3. Search when needed
aim_search_nodes({context: "alphanumeric", query: "voice"})

// 4. Update as you work
aim_add_observations({
  context: "alphanumeric",
  observations: [{
    entityName: "VoiceTerminal",
    contents: ["Added context switching", "Implemented project tabs"]
  }]
})
```

### Viewing All Databases
```javascript
aim_list_databases()  // Shows all available memory contexts
```

## Purpose
This `.claude/` directory contains **cross-project reusable resources** that can be shared across multiple projects. No project-specific content should be placed here.

## Directory Structure

```
.claude/
├── CLAUDE.md (this file)
├── agents/                    # Agent definitions (shared across all projects)
│   ├── *.md                  # Individual agent specifications
│   └── profiles/             # Agent behavioral profiles
│
├── teams/                    # Team configurations (shared templates only)
│   ├── templates/            # Reusable team templates
│   │   ├── ui-enhancement-team.yaml
│   │   ├── api-development-team.yaml
│   │   └── ...
│   ├── import-mechanism.md   # How to import teams
│   └── structure-proposal.md # Team architecture docs
│
└── notepad.md               # Cross-project notes

```

## What Goes Here

### ✅ ALLOWED (Cross-Project Resources)
- Agent definitions that work across projects
- Reusable team templates
- Import mechanisms and frameworks
- Shared documentation patterns
- Cross-project utilities

### ❌ NOT ALLOWED (Project-Specific Content)
- Project-specific team instances → Use `project/teams/instances/`
- Feature specifications → Use `project/specs/`
- Project handoff documents → Use `project/teams/instances/`
- Implementation code → Use `project/src/` or similar
- Project-specific configurations → Use project root

## Usage Examples

### Importing a Team Template
From any project, reference templates:
```yaml
@import-team: ui-enhancement-team
@from: .claude/teams/templates/
```

### Creating Project Instance
Team instances go in the PROJECT directory:
```
myproject/
├── teams/
│   └── instances/
│       └── feature-team-2025-08-01/
│           └── handoff.md
```

## Benefits

1. **Reusability**: Teams and agents shared across all projects
2. **Evolution**: Templates improve over time in one place
3. **Consistency**: Same patterns available everywhere
4. **Separation**: Clear boundary between shared/specific

## Maintenance

- Templates should be version-controlled
- Breaking changes require version bumps
- Project-specific modifications should NOT update templates
- Regular reviews to promote successful patterns to templates

---

Remember: This directory is for **cross-project sharing**. Keep project-specific content in project directories!