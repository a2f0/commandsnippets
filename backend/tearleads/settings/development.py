from .base import *  # noqa: F403, F401

TEARLEADS_SETTINGS_MODULE = "development"

INSTALLED_APPS += ("django_extensions",)  # noqa: F405

# Allow all hosts in development
# This is for cell phones running Capacitor.
ALLOWED_HOSTS = ["*"]
