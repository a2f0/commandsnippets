#!/bin/sh
echo "migrating db"
python manage.py migrate
echo "loading users"
python manage.py loaddata users users.yaml
echo "loading text entries"
python manage.py loaddata text_entries text_entries.yaml
echo "loading tags"
python manage.py loaddata text_entries tags.yaml
echo "loading text tag entry through model"
python manage.py loaddata text_entries text_tag_entry_through_model.yaml
