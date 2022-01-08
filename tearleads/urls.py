from django.conf import settings
from django.conf.urls import include
from django.contrib import admin
from django.urls import re_path

from tearleads.authentication.api import (
    CustomInvalidateAuthToken,
    CustomObtainAuthToken,
    GithubLogin,
    GoogleLogin,
)
from tearleads.healthcheck.api import HealthCheckAPIView
from tearleads.users.api import User

from .routers import router

urlpatterns = [
    re_path(r"^admin/", admin.site.urls),
    re_path(r"^api-token-auth/", CustomObtainAuthToken.as_view()),
    re_path(r"^api-token-deauth/", CustomInvalidateAuthToken.as_view()),
    re_path(r"^healthcheck/", HealthCheckAPIView.as_view(), name="healthcheck"),
    re_path(r"^api/v1/user/", User.as_view()),
    re_path(r"^api/v1/github-login/", GithubLogin.as_view()),
    re_path(r"^api/v1/google-login/", GoogleLogin.as_view()),
    re_path(r"^api/v1/", include(router.urls)),
]
