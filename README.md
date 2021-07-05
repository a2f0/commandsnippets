# Tearleads Backend

Bootstrap (Local dev)

    pip install pre-commit
    pre-commit install
    docker-compose build
    docker-compose run backend /app/loaddata.sh

Reset the databas (Local dev)

    docker-compose run backend python manage.py reset_db --noinput
    docker-compose run backend python manage.py migrate

Bootstrap (Server)

    docker-compose -f container-registry.yaml run backend /app/loaddata.sh
    docker-compose -f container-registry.yaml up -d

Backups (Server)

    docker-compose -f container-registry.yaml run postgres backup

Run tests

    docker-compose run backend python manage.py test --settings=tearleads.settings.test

Run isort

    docker-compose run backend isort --recursive --atomic .

Build an immutable container without host mounts

    ./containers.sh

Run the immutable container

    ./start.sh
