from django.conf.urls import include, url
from django.contrib import admin
from tearleads.authentication.api import (
    CustomObtainAuthToken,
    CustomInvalidateAuthToken,
    GithubLogin,
    GoogleLogin,
)
from tearleads.mock.api import MockGoogleOAuthAccessToken, MockGoogleOAuthUserInfo

from tearleads.users.api import User

from tearleads.healthcheck.api import HealthCheckAPIView

from .routers import router

urlpatterns = [
    url(r"^admin/", admin.site.urls),
    url(r"^api-token-auth/", CustomObtainAuthToken.as_view()),
    url(r"^api-token-deauth/", CustomInvalidateAuthToken.as_view()),
    url(r"^healthcheck/", HealthCheckAPIView.as_view(), name="healthcheck"),
    url(r"^mock/google/oauth2/access_token", MockGoogleOAuthAccessToken.as_view()),
    url(r"^mock/google/oauth2/v3/userinfo", MockGoogleOAuthUserInfo.as_view()),
    url(r"^api/v1/user/", User.as_view()),
    url(r"^api/v1/github-login/", GithubLogin.as_view()),
    url(r"^api/v1/google-login/", GoogleLogin.as_view()),
    url(r"^api/v1/", include(router.urls)),
]
