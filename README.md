# Tearleads Backend

## Development

Bootstrap

    pip install pre-commit
    pre-commit install
    pre-commit run --all-files
    docker-compose build
    docker-compose run backend python manage.py migrate
    docker-compose up

Bump version

    docker-compose run backend bump2version patch setup.cfg --allow-dirty

Show outdated dependencies

    docker-compose run backend safety check -r requirements/local.txt -r requirements/production.txt
    docker-compose run backend pur -r requirements/local.txt -r requirements/production.txt

Accessing the local Postgresql Database

    psql -h localhost -p 1337 -U tearleads
    \c tearleads
    -- list tables
    \dt
    select * from users_user;
    -- show colums for table
    \d users_user
    \q
    -- show counts by user
    select users_user.username,COUNT(*) as "number of entries"
    from text_entries_textentry left join users_user on users_user.id = text_entries_textentry.user_id
    group by users_user.username;

## Testing

Run tests

    docker-compose run backend coverage run manage.py test -v 2

Run a coverage report (note: the configuration of the coverage tool is in `.coveragerc` )

    docker-compose run backend coverage report

Run a specific class of tests

    docker-compose run backend python manage.py test tearleads.text_entries.tests.test_text_entries_api.TestTextEntriesApi

Run a specific test

    docker-compose run backend python manage.py test tearleads.users.tests.test_users_api.TestUsersApi.test_unauthenticated_user

## Administrative

Take a backup

    docker-compose -f container-registry.yaml run postgres backup

Delete a user

    docker-compose run backend python manage.py delete_user <username>

List users

    docker-compose run backend python manage.py list_users
