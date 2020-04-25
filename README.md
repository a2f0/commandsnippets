# Tearleads Backend

Bootstrap

    docker-compose build
    docker-compose run django python manage.py migrate
    ./loaddata.sh

Run tests

    docker-compose run django python manage.py test

Run black

    docker-compose run django black /app

Run isort

    docker-compose run django isort --recursive --atomic .

Configure a pre-commit hook for running tests

1. Create the `pre-commit` file

        touch ./.git/hooks/pre-commit

2. Paste the following into `./.git/hooks/pre-commit`

        #!/bin/bash
        set -e
        docker-compose run django python manage.py test --noinput
        exit 0

3. Make it executable

        `chmod 700 ./.git/hooks/pre-commit`

Drop to shell

    docker-compose run django python manage.py shell

Build an immutable container without host mounts

    ./containers.sh

Run the immutable container

    ./start.sh