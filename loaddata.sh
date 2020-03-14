#!/bin/sh
docker-compose run django python manage.py loaddata users users.yaml
docker-compose run django python manage.py loaddata text_entries text_entries.yaml