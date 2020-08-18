#!/bin/bash
set -e

echo "=== Restoring /backups/$1."
echo "=== Performing restore to $POSTGRES_DB"

export PGPASSWORD=$POSTGRES_PASSWORD

echo "=== Dropping $POSTGRES_DB"
dropdb $POSTGRES_DB -h $POSTGRES_HOST -U $POSTGRES_USER

echo "=== Creating $POSTGRES_DB"
createdb $POSTGRES_DB -h $POSTGRES_HOST -U $POSTGRES_USER

echo "=== Executing restore"
pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER \
    -d $POSTGRES_DB /backups/$1

echo "=== Done..."
