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

time download_latest tearleads.com