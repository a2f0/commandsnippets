# Tearleads Backend

Bootstrap (Local dev)

    pip install pre-commit
    pre-commit install
    docker-compose build
    docker-compose up

Run tests

    docker-compose run backend python manage.py test

Run isort

    docker-compose run backend isort --recursive --atomic .

Build an immutable container without host mounts

    ./containers.sh

Run the immutable container

    ./start.sh

## Administrative

Backups (Server)

    docker-compose -f container-registry.yaml run postgres backup

Reset the database (Local dev)

    docker-compose run backend python manage.py reset_db --noinput
    docker-compose run backend python manage.py migrate

Delete a user

    docker-compose run backend python manage.py delete_user <username>
