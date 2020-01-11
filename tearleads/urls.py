from django.conf.urls import url
from django.contrib import admin

from rest_framework.authtoken import views
from tearleads.healthcheck.api import HealthCheckAPIView

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^api-token-auth/',  views.obtain_auth_token),
    url(r'^health_check/',  HealthCheckAPIView.as_view(), name='share_report_detail'),
]
