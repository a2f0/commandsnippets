from .base import *

TEARLEADS_SETTINGS_MODULE = "development"

INSTALLED_APPS += ("django_extensions",)

# Allow all hosts in development (be careful with this!)
# This is only for local development and testing
ALLOWED_HOSTS = ["*"]
