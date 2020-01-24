# Tearleads Backend

Start the Compose

    docker-compose up

Run tests

    docker-compose run django python manage.py test

Drop to shell

    docker-compose run django python manage.py shell

Build an immutable container without host mounts

    ./containers.sh

Run the immutable container

    ./start.sh