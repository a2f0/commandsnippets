import os
from datetime import datetime, timedelta

import responses
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase
from tearleads.users.models import User


class TestIntegratedOAuth(BaseTestCase):
    def setUp(self):
        super(TestIntegratedOAuth, self).setUp()
        # Set up environment variables needed by the services
        os.environ["GOOGLE_CLIENT_ID"] = "test_google_client_id"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test_google_client_secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "test_redirect_uri"

    @responses.activate
    def test_successful_integrated_google_login_for_new_user(self):
        # Mock Google userinfo endpoint (no token exchange needed - direct access token)
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"email": "google_user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "token": "valid_google_token"},
            }
        }

        # Test to make sure the user doesn't exist before the login
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="google_user")

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        user = User.objects.get(username="google_user")
        self.assertNotEqual(user.last_login, None)
        self.assertEqual(user.last_login, user.date_joined)
        self.assertEqual(user.login_count, 1)
        existing_token = Token.objects.get(user=user)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertEqual(
            self.auth_user_api_client.cookies["Authorization"].value, existing_token.key
        )

    @responses.activate
    def test_successful_integrated_google_login_for_existing_user(self):
        # Create user beforehand
        existing_user = User.objects.create_user(
            username="google_user", email="google_user@example.com"
        )
        # Set an old login time to ensure it gets updated
        old_login_time = datetime.now() - timedelta(days=1)
        existing_user.last_login = old_login_time
        existing_user.save()

        # Verify initial login count is 1
        self.assertEqual(existing_user.login_count, 1)

        # Mock Google userinfo endpoint (no token exchange needed - direct access token)
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"email": "google_user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "token": "valid_google_token"},
            }
        }

        # Verify user exists before login attempt
        user_before = User.objects.get(username="google_user")
        self.assertEqual(user_before.id, existing_user.id)

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        # Get the user after login
        user_after = User.objects.get(username="google_user")
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

    def test_integrated_oauth_unsupported_provider(self):
        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "token": "valid_token"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        # Should return 400 with serializer validation error
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertEqual(
            response_data["errors"][0]["detail"], '"github" is not a valid choice.'
        )

    def test_integrated_oauth_invalid_serializer_data(self):
        self.auth_user_api_client = APIClient()
        # Missing provider field
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"token": "valid_token"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @responses.activate
    def test_integrated_oauth_google_invalid_token_response(self):
        # Mock the userinfo endpoint to fail (direct token case)
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "token": "invalid_token"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # Check for JSON:API error format
        self.assertTrue(isinstance(response.data, list))
        self.assertTrue(len(response.data) > 0)
        self.assertIn("detail", response.data[0])

    @responses.activate
    def test_google_direct_access_token_flow(self):
        """Test Google login with direct access token (iOS native auth)"""
        # Mock Google userinfo endpoint (no token exchange needed)
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"email": "native_user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "token": "direct_access_token"},
            }
        }

        # Test to make sure the user doesn't exist before the login
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="native_user")

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        user = User.objects.get(username="native_user")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(user.login_count, 1)

    @responses.activate
    def test_integrated_oauth_google_missing_email(self):
        # Mock Google userinfo endpoint without email (direct token case)
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"id": "12345", "name": "Test User"},  # No email field
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "token": "valid_token"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/integrated-oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # Check for JSON:API error format
        self.assertTrue(isinstance(response.data, list))
        self.assertTrue(len(response.data) > 0)
        self.assertIn("detail", response.data[0])
