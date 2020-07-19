#!/bin/bash
set -e 
echo "=== Backup Postgres database: $POSTGRES_DB"

FILENAME=backup_$(date +'%Y_%m_%dT%H_%M_%S').sql

export PGPASSWORD=$POSTGRES_PASSWORD

pg_dump --clean --no-owner -U $POSTGRES_USER \
      -h $POSTGRES_HOST $POSTGRES_DB > /backups/$FILENAME

echo "=== Backup completed."

echo "=== Listing file."

ls -l /backups/$FILENAME