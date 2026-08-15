#!/bin/sh
docker compose run backend bump2version patch setup.cfg --allow-dirty
