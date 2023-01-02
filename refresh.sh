#!/bin/bash
# Copy the Tearleads database around.
set -e
# The current directory
CURRENT_DIR=`pwd`
# The directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

mkdir -p ~/tearleads-backups

download_latest() {
  echo "=== downloading latest from: $1"
  f=$(ssh $1 "sudo sh -c 'ls -t /var/lib/docker/volumes/tearleads_postgres_backup/_data/*-Fc | head -1'")
  echo "=== most recent backup: $f"
  ssh $1 "mkdir -p /tmp/dbback && sudo cp $f /tmp/dbback/tearleads-Fc && sudo chown -R \`whoami\` /tmp/dbback"
  BASE_FILE=`basename $f`
  echo "=== base file: $BASE_FILE"
  scp $1:/tmp/dbback/tearleads-Fc ~/tearleads-backups/$BASE_FILE
  ssh $1 "rm -rf /tmp/dbback"
}

restore_latest_backup_local() {
  echo "=== entering $SCRIPT_DIR"
  cd $SCRIPT_DIR
  echo '=== running docker compose up -d'
  docker compose up -d
  echo '=== stopping django container'
  docker compose stop backend
  MOST_RECENT_FILE=`ls -t ~/tearleads-backups/* | head -1`
  BASE_FILE=`basename $MOST_RECENT_FILE`
  echo "=== restoring: $MOST_RECENT_FILE"
  echo '=== copying backup into docker container'
  docker cp $MOST_RECENT_FILE "$(docker compose ps -q postgres)":/backups
  echo '=== listing backups'
  docker compose run postgres list-backups
  echo '=== running postgres restore'
  docker compose run postgres restore $BASE_FILE
  echo '=== migrating database'
  docker compose run backend python manage.py migrate --settings=tearleads.settings.base
  echo '=== stopping compose'
  docker compose down
  echo '=== local refresh completed successfully'
}

restore_latest() {
  echo "=== authorotative_restore()"
  echo "=== restoring backup to: $1"
  MOST_RECENT_FILE=`ls -t ~/tearleads-backups/* | head -1`
  echo "=== restoring: $MOST_RECENT_FILE"
  ssh $1 "mkdir -p /tmp/dbback"
  scp $MOST_RECENT_FILE $1:/tmp/dbback/db-to-restore.sql
  ssh $1 "sudo mv /tmp/dbback/db-to-restore.sql /var/lib/docker/volumes/tearleads_postgres_backup/_data/"
  ssh $1 "cd ~/tearleads-backend && docker compose -f container-registry.yaml up -d"
  ssh $1 "cd ~/tearleads-backend && docker stop tearleads_backend_1"
  ssh $1 "cd ~/tearleads-backend && docker compose -f container-registry.yaml run postgres list-backups"
  ssh $1 "cd ~/tearleads-backend && docker compose -f container-registry.yaml run postgres restore db-to-restore.sql"
  ssh $1 "cd ~/tearleads-backend && docker compose -f container-registry.yaml down"
  ssh $1 "cd ~/tearleads-backend && docker compose -f container-registry.yaml up -d"
  ssh $1 "cd ~/tearleads-backend && docker system prune --force"

}

time download_latest pine.tearleads.com
time restore_latest_backup_local
#time restore_latest cedar.tearleads.com
