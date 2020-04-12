#!/bin/sh
echo "shutting down compose"
docker-compose down
echo "loading users"
docker-compose run django python manage.py loaddata users users.yaml
echo "loading text entries"
docker-compose run django python manage.py loaddata text_entries text_entries.yaml
echo "loading tags"
docker-compose run django python manage.py loaddata tags tags.yaml
echo "loading text tag entry through model"
docker-compose run django python manage.py loaddata tags text_tag_entry_through_model.yaml
echo "starting compose"
docker-compose up