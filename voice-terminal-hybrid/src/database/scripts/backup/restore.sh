#!/bin/bash

# PostgreSQL Restore Script for Voice Terminal Notification System
# Usage: ./restore.sh <backup_file> [database_name]

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_FILE="$1"
DB_NAME="${2:-$POSTGRES_DB}"
DB_USER="${POSTGRES_USER:-voice_terminal_user}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Validate input
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 <backup_file> [database_name]"
    echo "Example: $0 ./backups/backup_voice_terminal_db_20250118_120000.sql.gz"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}Starting PostgreSQL restore...${NC}"
echo "Backup File: $BACKUP_FILE"
echo "Target Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Warning prompt
echo -e "${YELLOW}WARNING: This will replace all data in database '$DB_NAME'${NC}"
echo -e "${YELLOW}Are you sure you want to continue? (yes/no)${NC}"
read -r CONFIRMATION

if [ "$CONFIRMATION" != "yes" ]; then
    echo -e "${BLUE}Restore cancelled by user${NC}"
    exit 0
fi

# Create temporary directory for decompression
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Check if file is compressed and decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo -e "${YELLOW}Decompressing backup file...${NC}"
    DECOMPRESSED_FILE="$TEMP_DIR/$(basename "${BACKUP_FILE%.gz}")"
    gunzip -c "$BACKUP_FILE" > "$DECOMPRESSED_FILE"
    RESTORE_FILE="$DECOMPRESSED_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Terminate existing connections to the database
echo -e "${YELLOW}Terminating existing connections to database...${NC}"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
    2>/dev/null || true

# Drop and recreate the database
echo -e "${YELLOW}Dropping existing database (if exists)...${NC}"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS $DB_NAME;" || true

echo -e "${YELLOW}Creating fresh database...${NC}"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "CREATE DATABASE $DB_NAME;"

# Restore the backup
echo -e "${YELLOW}Restoring database from backup...${NC}"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --set ON_ERROR_STOP=on \
    -f "$RESTORE_FILE"

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database restored successfully!${NC}"
    
    # Verify the restore
    echo -e "${YELLOW}Verifying restore...${NC}"
    TABLES=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'notifications';")
    
    echo -e "${GREEN}Found $TABLES tables in notifications schema${NC}"
    
    # Run ANALYZE to update statistics
    echo -e "${YELLOW}Updating database statistics...${NC}"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "ANALYZE;"
    
else
    echo -e "${RED}Error: Restore failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Restore completed successfully!${NC}"