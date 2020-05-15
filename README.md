# Tearleads Backend

Bootstrap

    docker-compose build
    docker-compose run backend /app/loaddata.sh

Run tests

    docker-compose run backend python manage.py test

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