# Tearleads Backend

## Development

Bootstrap

    pip install pre-commit
    pre-commit install
    docker-compose build
    docker-compose up

Run tests

    docker-compose run backend python manage.py test

Bump version

    docker-compose run backend bump2version minor setup.cfg --allow-dirty

Run isort

    docker-compose run backend isort --recursive --atomic .

Show outdated dependencies

    docker-compose run backend pip-review

## Administrative

Take a backup

    docker-compose -f container-registry.yaml run postgres backup

Delete a user

    docker-compose run backend python manage.py delete_user <username>
