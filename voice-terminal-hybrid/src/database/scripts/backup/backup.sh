#!/bin/bash

# PostgreSQL Backup Script for Voice Terminal Notification System
# Usage: ./backup.sh [database_name] [backup_directory]

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
DB_NAME="${1:-$POSTGRES_DB}"
DB_USER="${POSTGRES_USER:-voice_terminal_user}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${2:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Retention settings
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting PostgreSQL backup...${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup Directory: $BACKUP_DIR"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump command not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Perform the backup
echo -e "${YELLOW}Creating backup...${NC}"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --no-owner \
    --no-privileges \
    --format=plain \
    --create \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
    echo -e "${GREEN}Backup created successfully: $BACKUP_FILE${NC}"
    
    # Compress the backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    gzip -9 "$BACKUP_FILE"
    
    if [ -f "$COMPRESSED_FILE" ]; then
        echo -e "${GREEN}Backup compressed: $COMPRESSED_FILE${NC}"
        
        # Calculate and display file size
        SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')
        echo "Compressed backup size: $SIZE"
    fi
else
    echo -e "${RED}Error: Backup failed!${NC}"
    exit 1
fi

# Clean up old backups
echo -e "${YELLOW}Cleaning up old backups (older than $RETENTION_DAYS days)...${NC}"
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +$RETENTION_DAYS -exec rm {} \; -print

# List recent backups
echo -e "${GREEN}Recent backups:${NC}"
ls -lht "$BACKUP_DIR"/backup_${DB_NAME}_*.sql.gz 2>/dev/null | head -5 || echo "No backups found"

echo -e "${GREEN}Backup completed successfully!${NC}"