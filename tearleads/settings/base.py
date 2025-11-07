import configparser
import os

import environ

env = environ.Env()

config = configparser.RawConfigParser()
config.read("setup.cfg")
VERSION = config["bumpversion"]["current_version"]

TEARLEADS_SETTINGS_MODULE = "base"

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = env("DJANGO_SECRET_KEY")
COOKIE_DOMAIN = env("COOKIE_DOMAIN")

DEBUG = True

# Application definition

THIRD_PARTY_APPS = ["corsheaders", "rest_framework", "rest_framework.authtoken"]

LOCAL_APPS = [
    "tearleads.core",
    "tearleads.authentication",
    "tearleads.healthcheck",
    "tearleads.tags",
    "tearleads.text_entries",
    "tearleads.users",
]

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

INSTALLED_APPS = DJANGO_APPS + LOCAL_APPS + THIRD_PARTY_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "tearleads.core.middleware.ApiVersion",
]

ROOT_URLCONF = "tearleads.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "tearleads.wsgi.application"

# Also see ALLOWED_HOSTS

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:*",
    r"^http://127\.0\.0\.1:*",
    # RFC 1918 private address space
    r"^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:*",  # 10.0.0.0/8
    r"^http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}:*",  # 172.16.0.0/12
    r"^http://192\.168\.\d{1,3}\.\d{1,3}:*",  # 192.168.0.0/16
    # Production domains
    r"^https://tearleads\.com$",
    r"^https://\w+\.tearleads\.com$",
    # Staging domains
    r"^https://\w+\.staging\.tearleads\.com$",
]

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    ".tearleads.com",
    "tearleads.com",
]

CORS_ALLOW_CREDENTIALS = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "HOST": os.environ["POSTGRES_HOST"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "PORT": os.environ["POSTGRES_PORT"],
        "USER": os.environ["POSTGRES_USER"],
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": ("django.contrib.auth.password_validation.MinimumLengthValidator"),
    },
    {
        "NAME": ("django.contrib.auth.password_validation.CommonPasswordValidator"),
    },
    {
        "NAME": ("django.contrib.auth.password_validation.NumericPasswordValidator"),
    },
]

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = False

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.2/howto/static-files/

STATIC_URL = "/static/"

AUTH_USER_MODEL = "users.User"

# Authentication cookie settings
AUTH_COOKIE_MAX_AGE = 2419200  # 28 days in seconds

REST_FRAMEWORK = {
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "rest_framework_json_api.exceptions.exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "tearleads.authentication.utility.CustomAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework_json_api.pagination.JsonApiPageNumberPagination"
    ),
    "DEFAULT_PARSER_CLASSES": (
        "rest_framework_json_api.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework_json_api.renderers.JSONRenderer",),
    "DEFAULT_METADATA_CLASS": "rest_framework_json_api.metadata.JSONAPIMetadata",
    "DEFAULT_FILTER_BACKENDS": (
        "rest_framework_json_api.filters.QueryParameterValidationFilter",
        "rest_framework_json_api.filters.OrderingFilter",
        "rest_framework_json_api.django_filters.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
    ),
    "SEARCH_PARAM": "filter[search]",
    "TEST_REQUEST_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework_json_api.renderers.JSONRenderer",
    ),
    "TEST_REQUEST_DEFAULT_FORMAT": "vnd.api+json",
}

# Preferred field for primary keys

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
