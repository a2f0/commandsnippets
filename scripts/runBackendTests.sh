#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
backend_directory=$(dirname "$script_directory")/backend

export COOKIE_DOMAIN="${COOKIE_DOMAIN:-localhost}"
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-test}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-tearleads.settings.test}"
export GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-github_client_id}"
export GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-github_client_secret}"
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-google_client_id}"
export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-google_client_secret}"
export GOOGLE_REDIRECT_URI="${GOOGLE_REDIRECT_URI:-google_redirect_uri}"
export POSTGRES_DB="${POSTGRES_DB:-postgres}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"

cd "$backend_directory"
coverage run manage.py test -v 2 "$@"
coverage report
