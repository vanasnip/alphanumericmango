#!/bin/bash

# Pre-Push Hook Setup Script
# Configures the comprehensive pre-push validation system

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Setting up comprehensive pre-push hook system...${NC}"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm: $(npm --version)"

# Check git
if ! command -v git &> /dev/null; then
    echo "❌ git is not installed"
    exit 1
fi
echo "✅ git: $(git --version)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed - required for act"
    echo "   Install Docker Desktop: https://www.docker.com/products/docker-desktop"
else
    if ! docker info &> /dev/null; then
        echo "⚠️  Docker is installed but not running"
        echo "   Please start Docker Desktop"
    else
        echo "✅ Docker is running"
    fi
fi

# Check act
if ! command -v act &> /dev/null; then
    echo "⚠️  act is not installed - required for local CI"
    echo ""
    echo "Install act:"
    echo "  macOS: brew install act"
    echo "  Linux: Download from https://github.com/nektos/act/releases"
    echo "  Windows: choco install act-cli"
    echo ""
    read -p "Continue without act? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ act: $(act --version)"
fi

echo ""
echo "🛠️  Configuring pre-push system..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup husky
echo "🪝 Setting up husky..."
npm run prepare

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/pre-push-ci.sh
chmod +x .husky/pre-push

# Create local environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📄 Creating local environment file..."
    cp .env.local.example .env.local
    echo "✅ Created .env.local from template"
else
    echo "✅ .env.local already exists"
fi

# Test act configuration
if command -v act &> /dev/null; then
    echo "🧪 Testing act configuration..."
    if act --list &> /dev/null; then
        echo "✅ act configuration is valid"
    else
        echo "⚠️  act configuration issues detected"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Pre-push hook system setup complete!${NC}"
echo ""
echo -e "${BLUE}Usage:${NC}"
echo "  • Push normally: git push origin branch-name"
echo "  • Manual validation: npm run ci:local"
echo "  • Emergency bypass: git push --no-verify"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo "  npm run ci:local          # Full pre-push validation"
echo "  npm run ci:act:main       # Main CI pipeline only"
echo "  npm run ci:act:voice      # Voice terminal tests"
echo "  npm run ci:act:electron   # Electron tests"
echo "  npm run audit:security    # Security audit only"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Read PRE_PUSH_GUIDE.md for detailed usage"
echo "  2. Test with: npm run ci:test"
echo "  3. Try a validation: npm run ci:local"
echo ""
echo -e "${BLUE}Happy coding! 🚀${NC}"