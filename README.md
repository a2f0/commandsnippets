# Tearleads Backend

## Development

### Bootstrap

Install SOPS and GnuPG, import the private GPG key for fingerprint
`6FFAEA28B304FA98E7521822827B8379F39A31F0`, and decrypt the local environment:

```shell
# macOS
brew install gnupg sops

./decrypt-secrets.sh
```

```shell
pyenv install `cat .python-version`
pip install pre-commit
pre-commit install
pre-commit run --all-files
docker compose build --no-cache
docker compose run --rm backend python manage.py migrate
docker compose up

# Optional: create a virtual environment for IDE, linting, etc.
# macOS
brew install postgresql # Provides `pg_config`
# All platforms
python -m venv venv
source ./venv/bin/activate
pip install -r requirements/base.txt -r requirements/local.txt
```

Bump version

```shell
docker compose run --rm backend bump2version patch setup.cfg --allow-dirty
```

Show outdated dependencies

```shell
docker compose build --no-cache
docker compose run --rm backend pur -r requirements/local.txt -r requirements/production.txt

# venv
pur -r requirements/local.txt -r requirements/production.txt
```

### Secrets

Secrets are stored as SOPS-encrypted dotenv files using the GPG recipients in
`.sops.yaml`. Plaintext environment files are ignored by Git.

Edit a secret file in place:

```shell
sops edit .env-local-development.sops.env
sops edit .env-staging.sops.env
sops edit .env-production.sops.env
```

After changing the GPG recipients in `.sops.yaml`, update each encrypted file:

```shell
sops updatekeys .env-local-development.sops.env
sops updatekeys .env-staging.sops.env
sops updatekeys .env-production.sops.env
```

`./update_secrets.sh` decrypts staging and production secrets into temporary
files, copies them to their deployment hosts, and removes the temporary files.

## Testing

Run tests

```shell
docker compose run --rm backend python manage.py test -v 2
docker compose run --rm backend python -Wa manage.py test -v 2 # show warnings
docker compose run --rm backend coverage run manage.py test -v 2
```

Run a coverage report (the configuration is in `.coveragerc`).

```shell
docker compose run --rm backend coverage report
```

Run a specific class of tests

```shell
docker compose run --rm backend python manage.py test tearleads.text_entries.tests.test_text_entries_api.TestTextEntriesApi
```

Run a specific test

```shell
docker compose run --rm backend python manage.py test tearleads.users.tests.test_users_api.TestUsersApi.test_unauthenticated_user
```

## Administrative

### General

Take a backup

```shell
docker compose -f container-registry.yaml run --rm postgres backup
```

Delete a user

```shell
docker compose run --rm backend python manage.py delete_user <username>
```

List users

```shell
docker compose run --rm backend python manage.py list_users
docker compose run --rm backend python manage.py list_recent_logins
docker compose run --rm backend python manage.py usage_report
```

Accessing the local PostgreSQL database

```sql
psql -h localhost -p 1337 -U tearleads
\c tearleads
-- list tables
\dt
select * from users_user order by date_joined desc;
-- show columns for table
\d users_user
\q
-- show counts by user
select users_user.username,COUNT(*) as "number of entries"
from text_entries_textentry left join users_user on users_user.id = text_entries_textentry.user_id
group by users_user.username;
```

### Upgrading the Postgres Docker Container

1. Run `./refresh.sh` to obtain the most recent backup.
2. Update the backend's [Dockerfile](compose/postgres/Dockerfile) to the new
   image.
3. Update the `postgresXX_data_dev` volume in `docker compose.yaml` to the new
   version.
4. Start the compose with `docker compose up`. This should show a new database
   being created in the `postgres` container.
5. Kill the backend container with `docker compose kill backend` to free up the
   database connections.
6. List backups with `docker compose run --rm postgres list-backups`
7. Do a restore with `docker compose run --rm postgres restore backup-pg_dump-Fc`
8. Update the data volume in `staging.yaml` and `container-registry.yaml`.
9. Update the container in `.github/workflows/main.yml`.

### Upgrading the Python Version

1. Update `.python-version`
2. Update the version used in the Dockerfiles
   [Dockerfile.dev](compose/django/Dockerfile.dev) and
   [Dockerfile.prod](compose/django/Dockerfile.prod).
3. Update the version used by GitHub Actions in `main.yml`.
4. Run `docker compose build --no-cache` to do a clean container build.
5. Run unit and integration tests to make sure they pass.

### OAuth

- The [Google OAuth client configuration][google-oauth] can be accessed by
  `dan@devopsrockstars.com`.

[google-oauth]: https://console.cloud.google.com/auth/clients/424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com?project=tearleads
