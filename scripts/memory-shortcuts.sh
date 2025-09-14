#!/bin/bash

# Memory MCP Quick Access Shortcuts
# Add these aliases to your shell profile (.bashrc, .zshrc, etc.)

# Quick search in project memory
alias mem-search='echo "aim_search_nodes({context: \"alphanumeric\", query: \"$1\"})"'

# Show entire project knowledge graph
alias mem-graph='echo "aim_read_graph({context: \"alphanumeric\"})"'

# List all memory databases
alias mem-list='echo "aim_list_databases()"'

# Show specific entity details
alias mem-show='echo "aim_open_nodes({context: \"alphanumeric\", names: [\"$1\"]})"'

# Quick add observation to entity
alias mem-add='echo "aim_add_observations({context: \"alphanumeric\", observations: [{entityName: \"$1\", contents: [\"$2\"]}]})"'

# Search in architecture context
alias mem-arch='echo "aim_search_nodes({context: \"alphanumeric-architecture\", query: \"$1\"})"'

# Search in performance context
alias mem-perf='echo "aim_search_nodes({context: \"alphanumeric-performance\", query: \"$1\"})"'

# Search for bugs
alias mem-bugs='echo "aim_search_nodes({context: \"alphanumeric\", query: \"bug $1\"})"'

# Search for decisions
alias mem-decisions='echo "aim_search_nodes({context: \"alphanumeric\", query: \"decision $1\"})"'

# Usage instructions
echo "Memory MCP Shortcuts Loaded!"
echo ""
echo "Available commands:"
echo "  mem-search <query>     - Search project memory"
echo "  mem-graph             - Show entire knowledge graph"
echo "  mem-list              - List all databases"
echo "  mem-show <entity>     - Show specific entity"
echo "  mem-add <entity> <obs> - Add observation to entity"
echo "  mem-arch <query>      - Search architecture context"
echo "  mem-perf <query>      - Search performance context"
echo "  mem-bugs <query>      - Search for bugs"
echo "  mem-decisions <query> - Search for decisions"
echo ""
echo "Copy the output and paste into Claude to execute the memory query."