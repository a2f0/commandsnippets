#!/bin/sh
echo "loading users"
docker-compose run django python manage.py loaddata users users.yaml
echo "loading text entries"
docker-compose run django python manage.py loaddata text_entries text_entries.yaml
echo "loading tags"
docker-compose run django python manage.py loaddata tags tags.yaml