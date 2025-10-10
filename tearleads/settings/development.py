from .base import *

TEARLEADS_SETTINGS_MODULE = "development"

INSTALLED_APPS += ("django_extensions",)

# Allow all hosts in development
# This is for cell phones running Capacitor.
ALLOWED_HOSTS = ["*"]
