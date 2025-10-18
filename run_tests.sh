#!/bin/sh
set -e
docker compose run backend python manage.py test -v 2
