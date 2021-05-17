import time
import httpretty

from unittest import skip
from django.contrib.staticfiles.testing import LiveServerTestCase
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase
from tearleads.authentication.services import GoogleOAuthService

from httpretty import httprettified


class TestGoogleAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGoogleAuthentication, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestGoogleAuthentication, cls).setUpTestData()

    @httprettified
    def test_access_token(self):
        service = GoogleOAuthService()
        httpretty.register_uri(
            httpretty.POST,
            "https://oauth2.googleapis.com/token",
            body='{"access_token": "access_token"}',
        )
        response = service.access_token(code="code")
        self.assertEqual(response.json(), {"access_token": "access_token"})

    @httprettified
    def test_user(self):
        service = GoogleOAuthService()
        httpretty.register_uri(
            httpretty.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            body='{"email": "user@example.com"}',
        )
        response = service.user(access_token="access_token")
        self.assertEqual(response.json(), {"email": "user@example.com"})
