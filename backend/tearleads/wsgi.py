"""
WSGI config for tearleads project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.11/howto/deployment/wsgi/
"""

import os
from os import environ as newrelic_en

from django.core.wsgi import get_wsgi_application

if newrelic_en.get("NEW_RELIC_ENABLED") == "True":
    print("=== Loading New Relic...")
    import newrelic.agent

    new_relic_enviroment = os.environ.get("NEW_RELIC_ENVIRONMENT")
    print("=== New Relic Environment: " + new_relic_enviroment)
    newrelic.agent.initialize(
        config_file="./newrelic.ini", environment=new_relic_enviroment
    )
else:
    print("=== Skipping New Relic...")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tearleads.settings")

application = get_wsgi_application()
