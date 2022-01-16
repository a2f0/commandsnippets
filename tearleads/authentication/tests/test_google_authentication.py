import time
from unittest import skip

import httpretty
from django.contrib.staticfiles.testing import LiveServerTestCase
from rest_framework import status
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase


class TestGoogleAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGoogleAuthentication, self).setUp()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()

    @httpretty.activate(verbose=True, allow_net_connect=False)
    def test_successful_google_login(self):
        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }
        httpretty.register_uri(
            httpretty.POST,
            "https://oauth2.googleapis.com/token",
            body='{"access_token": "access_token"}',
        )
        httpretty.register_uri(
            httpretty.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            body='{"email": "user@example.com"}',
        )
        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertEqual("LoggedIn" in self.auth_user_api_client.cookies, True)
        self.assertNotEqual(
            self.auth_user_api_client.cookies["Authorization"].value, ""
        )
