import os
import time
from unittest import skip

import responses
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

    @responses.activate
    def test_successful_google_login_for_new_user(self):
        # Mock Google OAuth token endpoint
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "access_token": "test_access_token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
            content_type="application/json",
        )

        # Mock Google userinfo endpoint
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"email": "user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }

        # test to make sure the user doesnt exist before the login.
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="user")

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        user = User.objects.get(username="user")
        self.assertNotEqual(user.last_login, None)
        self.assertEqual(user.last_login, user.date_joined)
        self.assertEqual(user.login_count, 1)
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

    @responses.activate
    def test_google_login_invalid_code_exchange(self):
        # Mock Google OAuth token endpoint with error for code exchange
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "error": "invalid_grant",
                "error_description": "Invalid authorization code",
            },
            status=400,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "invalid_code"}}
        }

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @responses.activate
    def test_google_login_user_info_fetch_failure(self):
        # Mock Google OAuth token endpoint
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        # Mock successful token exchange
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "access_token": "test_access_token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
            content_type="application/json",
        )

        # Mock failed user info fetch with new token
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "invalid_code"}}
        }

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @responses.activate
    def test_google_login_missing_email(self):
        # Mock Google OAuth token endpoint
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "access_token": "test_access_token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
            content_type="application/json",
        )

        # Mock Google userinfo endpoint without email
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"id": "12345", "name": "Test User"},  # No email field
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @responses.activate
    def test_successful_google_login_for_existing_user(self):
        # Create user beforehand
        existing_user = User.objects.create_user(
            username="user", email="user@example.com"
        )
        old_login_time = existing_user.last_login

        # Verify initial login count is 1
        self.assertEqual(existing_user.login_count, 1)

        # Mock Google OAuth token endpoint
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "access_token": "test_access_token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
            content_type="application/json",
        )

        # Mock Google userinfo endpoint
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"email": "user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }

        # Verify user exists before login attempt
        user_before = User.objects.get(username="user")
        self.assertEqual(user_before.id, existing_user.id)

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        # Get the user after login
        user_after = User.objects.get(username="user")
        self.assertEqual(user_after.id, existing_user.id)  # Same user
        self.assertNotEqual(user_after.last_login, old_login_time)  # Login time updated

        # Login count should be incremented to 2 since this is the second login
        self.assertEqual(user_after.login_count, 2)

        # Check for token and cookies
        existing_token = Token.objects.get(user=user_after)
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

    @responses.activate
    def test_google_login_invalid_code_exchange(self):
        # Mock Google OAuth token endpoint with error for code exchange
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "error": "invalid_grant",
                "error_description": "Invalid authorization code",
            },
            status=400,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "invalid_code"}}
        }

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @responses.activate
    def test_google_login_user_info_fetch_failure(self):
        # Mock Google OAuth token endpoint
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        # Mock successful token exchange
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "access_token": "test_access_token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
            content_type="application/json",
        )

        # Mock failed user info fetch with new token
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "invalid_code"}}
        }

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @responses.activate
    def test_google_login_missing_email(self):
        # Mock Google OAuth token endpoint
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={
                "access_token": "test_access_token",
                "token_type": "Bearer",
                "expires_in": 3600,
            },
            status=200,
            content_type="application/json",
        )

        # Mock Google userinfo endpoint without email
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"id": "12345", "name": "Test User"},  # No email field
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }

        response = self.auth_user_api_client.post("/api/v1/google-login/", payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
