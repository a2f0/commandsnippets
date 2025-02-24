import os
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
        # Set up environment variables needed by the service
        os.environ["GOOGLE_CLIENT_ID"] = "test_client_id"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test_client_secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "test_redirect_uri"

    @httpretty.activate
    def test_successful_google_login(self):
        # Mock Google OAuth token endpoint with expected JSON response
        httpretty.register_uri(
            httpretty.POST,
            "https://oauth2.googleapis.com/token",
            body='{"access_token": "test_access_token", "token_type": "Bearer", "expires_in": 3600}',
            status=200,
            adding_headers={"content-type": "application/json"},
        )

        # Mock Google userinfo endpoint with expected JSON response
        httpretty.register_uri(
            httpretty.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            body='{"email": "user@example.com", "email_verified": true}',
            status=200,
            adding_headers={"content-type": "application/json"},
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }

        # test to make sure the user doesnt exist before the login.
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="user")

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        # Print debug info about the requests
        print("\nLast request:", httpretty.last_request())
        print("Last request headers:", httpretty.last_request().headers)
        print("Last request body:", httpretty.last_request().body)

        # Continue with assertions...
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
