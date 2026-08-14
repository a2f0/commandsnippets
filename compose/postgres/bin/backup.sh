#!/bin/sh
# Vendored from a2f0/pg-container-utils@97e0f191ee063c2c227d30f164dca700f6ca26f3.
set -e

DATE_FORMAT=$(date +'%Y_%m_%dT%H_%M_%S')
echo "=== Backup Postgres database: $POSTGRES_DB - $DATE_FORMAT"

FILENAME=backup_$DATE_FORMAT-pg_dump-Fc

export PGPASSWORD="$POSTGRES_PASSWORD"

pg_dump --clean --no-owner -Fc -U "$POSTGRES_USER" \
      -h "$POSTGRES_HOST" "$POSTGRES_DB" > "/backups/$FILENAME"

echo "=== Backup completed."
echo "=== Listing file."

ls -l "/backups/$FILENAME"
