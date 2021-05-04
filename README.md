# Tearleads Backend

Bootstrap (Local dev)

    pip3 install pre-commit
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

Run black

    docker-compose run backend black /app

Run isort

    docker-compose run backend isort --recursive --atomic .

Change a password

    docker-compose run backend python manage.py changepassword dps

Configure a pre-commit hook for running tests

1. Create the `pre-commit` file

        touch ./.git/hooks/pre-commit

2. Paste the following into `./.git/hooks/pre-commit`

        #!/bin/bash
        set -e
        docker-compose run backend python manage.py test --noinput
        exit 0

3. Make it executable

        `chmod 700 ./.git/hooks/pre-commit`

Drop to shell

    docker-compose run backend python manage.py shell

Build an immutable container without host mounts

    ./containers.sh

Run the immutable container

    ./start.sh
