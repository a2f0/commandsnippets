import time
from unittest import skip

import httpretty
from django.conf import settings
from django.contrib.staticfiles.testing import LiveServerTestCase
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase
from tearleads.users.models import User


class TestGoogleAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGoogleAuthentication, self).setUp()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()

    @httpretty.activate(verbose=True, allow_net_connect=True)
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
        # test to make sure the user doesnt exist before the login.
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="user")
        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)
        # see that the user was created
        user = User.objects.get(username="user")
        existing_token = Token.objects.get(user=user)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertEqual(
            self.auth_user_api_client.cookies["Authorization"].value, existing_token.key
        )
        self.assertEqual(
            self.auth_user_api_client.cookies["Authorization"]["domain"],
            settings.COOKIE_DOMAIN,
        )
        self.assertEqual(
            self.auth_user_api_client.cookies["Authorization"]["max-age"], 2419200
        )
        self.assertEqual("LoggedIn" in self.auth_user_api_client.cookies, True)
        self.assertEqual(
            self.auth_user_api_client.cookies["LoggedIn"]["max-age"], 2419200
        )
        self.assertEqual(
            self.auth_user_api_client.cookies["LoggedIn"]["domain"],
            settings.COOKIE_DOMAIN,
        )
        self.assertNotEqual(
            self.auth_user_api_client.cookies["Authorization"].value, ""
        )
