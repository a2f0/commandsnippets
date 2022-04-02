# Tearleads Backend

## Development

Bootstrap

    pip install pre-commit
    pre-commit install
    pre-commit run --all-files
    docker-compose build
    docker-compose up

Run tests

    docker-compose run backend coverage run manage.py test -v 2

Run a coverage report (note: the configuration of the coverage tool is in `.coveragerc` )

    docker-compose run backend coverage report

Bump version

    docker-compose run backend bump2version patch setup.cfg --allow-dirty

Show outdated dependencies

    docker-compose run backend safety check -r requirements/local.txt -r requirements/production.txt
    docker-compose run backend pur -r requirements/local.txt -r requirements/production.txt

## Administrative

Take a backup

    docker-compose -f container-registry.yaml run postgres backup

Delete a user

    docker-compose run backend python manage.py delete_user <username>
