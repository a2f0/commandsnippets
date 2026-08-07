import re

from django.utils import cache

# DRF 3.17.2 imports this private delimiter, which Django 6.1 removed.
# Remove this shim once https://github.com/encode/django-rest-framework/pull/9978
# is included in a PyPI release.
if not hasattr(cache, "cc_delim_re"):
    cache.cc_delim_re = re.compile(r"\s*,\s*")
