#!/bin/bash

echo "🚀 Setting up fast pre-commit hooks..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
npm run install:workspaces

# Initialize husky
echo "🐶 Initializing husky..."
npx husky install

# Make the pre-commit hook executable
chmod +x .husky/pre-commit

echo "✅ Pre-commit hooks setup completed!"
echo ""
echo "📋 What was configured:"
echo "  ✓ Husky for git hooks"
echo "  ✓ lint-staged for staging area operations"
echo "  ✓ ESLint for TypeScript/JavaScript linting"
echo "  ✓ Prettier for code formatting"
echo "  ✓ TypeScript incremental checking"
echo "  ✓ Vitest for focused testing"
echo ""
echo "⚡ Performance optimizations:"
echo "  ✓ Only staged files are processed"
echo "  ✓ Parallel execution where possible"
echo "  ✓ Incremental TypeScript checking"
echo "  ✓ Fast test reporter for pre-commit"
echo "  ✓ Skip lib checking for speed"
echo ""
echo "🎯 Target: <5 seconds execution time"
echo ""
echo "To test the hook, stage some files and run:"
echo "  git add . && npx lint-staged"