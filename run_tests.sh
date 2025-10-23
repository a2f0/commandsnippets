#!/bin/sh
set -e
docker compose run --rm backend python manage.py test -v 2
