#!/bin/sh
# Vendored from a2f0/pg-container-utils@97e0f191ee063c2c227d30f164dca700f6ca26f3.
set -e

echo "=== Restoring /backups/$1."
echo "=== Performing restore to $POSTGRES_DB"

export PGPASSWORD="$POSTGRES_PASSWORD"

echo "=== Refreshing collation versions"
for db in postgres template1; do
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres \
        -c "ALTER DATABASE $db REFRESH COLLATION VERSION;" 2>/dev/null || true
done

echo "=== Dropping $POSTGRES_DB"
dropdb "$POSTGRES_DB" -h "$POSTGRES_HOST" -U "$POSTGRES_USER" --if-exists

echo "=== Creating $POSTGRES_DB"
createdb "$POSTGRES_DB" -h "$POSTGRES_HOST" -U "$POSTGRES_USER"

echo "=== Executing restore"
pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" /backups/"$1"

echo "=== Done..."
