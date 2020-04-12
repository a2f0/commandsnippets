from django.conf.urls import include, url
from django.contrib import admin
from rest_framework.authtoken import views

from tearleads.healthcheck.api import HealthCheckAPIView

from .routers import router

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^api-token-auth/',  views.obtain_auth_token),
    url(r'^healthcheck/',  HealthCheckAPIView.as_view(), name='healthcheck'),
    url(r'^api/v1/', include(router.urls)),
]
