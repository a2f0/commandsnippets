#!/bin/sh
set -eu

usage() {
  echo "Usage: $0 <staging|production> [all|build|upload]" >&2
  exit 2
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 is required but was not found in PATH" >&2
    exit 1
  fi
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  usage
fi

environment=$1
phase=${2:-all}

case "$environment" in
  staging)
    deploy_domain=${DEPLOY_DOMAIN:-${STAGING_DOMAIN:-}}
    ;;
  production)
    deploy_domain=${DEPLOY_DOMAIN:-${PRODUCTION_DOMAIN:-}}
    ;;
  *)
    usage
    ;;
esac

case "$phase" in
  all | build | upload) ;;
  *) usage ;;
esac

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
frontend_directory=$(dirname "$script_directory")/frontend

build_app() {
  require_command pnpm
  (
    cd "$frontend_directory"
    pnpm run build
  )
}

upload_app() {
  require_command aws

  if [ -z "$deploy_domain" ]; then
    echo "ERROR: DEPLOY_DOMAIN or the environment's *_DOMAIN is required" >&2
    exit 1
  fi

  build_directory="$frontend_directory/build"
  if [ ! -f "$build_directory/index.html" ]; then
    echo "ERROR: $build_directory/index.html does not exist; run the build phase first" >&2
    exit 1
  fi

  aws s3 sync --acl=public-read "$build_directory" \
    "s3://$deploy_domain" --exclude "index.html"
  aws s3 cp --acl=public-read "$build_directory/index.html" \
    "s3://$deploy_domain/index.html"
  aws s3 sync --acl=public-read --delete "$build_directory" \
    "s3://$deploy_domain"
}

case "$phase" in
  all)
    build_app
    upload_app
    ;;
  build)
    build_app
    ;;
  upload)
    upload_app
    ;;
esac
