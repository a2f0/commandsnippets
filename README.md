# Tearleads Backend

## Development

### Bootstrap

```shell
    pyenv install `cat .python-version`
    pip install pre-commit
    pre-commit install
    pre-commit run --all-files
    docker-compose build --no-cache
    docker-compose run backend python manage.py migrate
    docker-compose up

    # Optional
    # Create Create a virtual environment for IDE, linting, etc.
    # MacOS
    brew install postgresql # Provides `pg_config`
    # All platforms
    python -m venv venv
    source ./venv/bin/activate
    pip install -r requirements/base.txt -r requirements/local.txt
```

Bump version

    docker-compose run backend bump2version patch setup.cfg --allow-dirty

Show outdated dependencies

    docker-compose build --no-cache
    docker-compose run backend pur -r requirements/local.txt -r requirements/production.txt

    # venv
    pur -r requirements/local.txt -r requirements/production.txt

## Testing

Run tests

    docker-compose run backend python manage.py test -v 2
    docker-compose run backend python -Wa manage.py test -v 2 # show warnings
    docker-compose run backend coverage run manage.py test -v 2

Run a coverage report (note: the configuration of the coverage tool is in `.coveragerc` )

    docker-compose run backend coverage report

Run a specific class of tests

    docker-compose run backend python manage.py test tearleads.text_entries.tests.test_text_entries_api.TestTextEntriesApi

Run a specific test

    docker-compose run backend python manage.py test tearleads.users.tests.test_users_api.TestUsersApi.test_unauthenticated_user

## Administrative

### General

Take a backup

    docker-compose -f container-registry.yaml run postgres backup

Delete a user

    docker-compose run backend python manage.py delete_user <username>

List users

    docker-compose run backend python manage.py list_users

Accessing the local Postgresql Database

    psql -h localhost -p 1337 -U tearleads
    \c tearleads
    -- list tables
    \dt
    select * from users_user order by date_joined desc;
    -- show colums for table
    \d users_user
    \q
    -- show counts by user
    select users_user.username,COUNT(*) as "number of entries"
    from text_entries_textentry left join users_user on users_user.id = text_entries_textentry.user_id
    group by users_user.username;

### Upgrading the Postgres Docker Container

1. Run `./refresh.sh` to obtain the most recent backup.
2. Update the backend's [Dockerfile](compose/postgres/Dockerfile) to the new image.
3. Update the `postgresXX_data_dev` volume in `docker-compose.yaml` to the new version.
4. Start the compose with `docker-compose up`.  This should show a new database being created in the `postgres` container.
5. Kill the backend container with `docker-compose kill backend` to free up the database connections.
6. List backups with `docker-compose run postgres list-backups`
7. Do a restore with `docker-compose run postgres restore backup-pg_dump-Fc`
8. Update the data volume in `staging.yaml` and `container-registry.yaml`.
9. Update the container in `.github/workflows/main.yml`.

### Upgrading the python version

1. Update `.python-version`
2. Update the version used in the Dockerfiles [Dockerfile.dev](compose/django/Dockerfile.dev), [Dockerfile.prod](compose/django/Dockerfile.prod)
3. Update the version used by Github actions in `main.yml`
4. Run `docker-compose build --no-cache` to do a clean container build.
5. Run unit and integration tests to make sure they pass.
