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


class TestIntegratedOAuth(BaseTestCase):
    def setUp(self):
        super(TestIntegratedOAuth, self).setUp()
        # Set up environment variables needed by the services
        os.environ["GITHUB_CLIENT_ID"] = "test_github_client_id"
        os.environ["GITHUB_CLIENT_SECRET"] = "test_github_client_secret"
        os.environ["GOOGLE_CLIENT_ID"] = "test_google_client_id"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test_google_client_secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "test_redirect_uri"

    @responses.activate
    def test_successful_integrated_github_login_for_new_user(self):
        # Mock GitHub OAuth token endpoint
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=test_access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )

        # Mock GitHub user endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"login": "github_user"},
            status=200,
            content_type="application/json",
        )

        # Mock GitHub emails endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user/emails",
            json=[
                {"email": "github_user@example.com", "primary": True, "verified": True}
            ],
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "valid_github_code"},
            }
        }

        # Test to make sure the user doesn't exist before the login
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="github_user")

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        user = User.objects.get(username="github_user")
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
    def test_successful_integrated_google_login_for_new_user(self):
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
            json={"email": "google_user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "code": "valid_google_code"},
            }
        }

        # Test to make sure the user doesn't exist before the login
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="google_user")

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

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
    def test_successful_integrated_github_login_for_existing_user(self):
        # Create user beforehand
        existing_user = User.objects.create_user(
            username="github_user", email="github_user@example.com"
        )
        # Set an old login time to ensure it gets updated
        from datetime import datetime, timedelta

        old_login_time = datetime.now() - timedelta(days=1)
        existing_user.last_login = old_login_time
        existing_user.save()

        # Verify initial login count is 1
        self.assertEqual(existing_user.login_count, 1)

        # Mock GitHub OAuth token endpoint
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=test_access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )

        # Mock GitHub user endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"login": "github_user"},
            status=200,
            content_type="application/json",
        )

        # Mock GitHub emails endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user/emails",
            json=[
                {"email": "github_user@example.com", "primary": True, "verified": True}
            ],
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "valid_github_code"},
            }
        }

        # Verify user exists before login attempt
        user_before = User.objects.get(username="github_user")
        self.assertEqual(user_before.id, existing_user.id)

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        # Get the user after login
        user_after = User.objects.get(username="github_user")
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

    @responses.activate
    def test_successful_integrated_google_login_for_existing_user(self):
        # Create user beforehand
        existing_user = User.objects.create_user(
            username="google_user", email="google_user@example.com"
        )
        # Set an old login time to ensure it gets updated
        from datetime import datetime, timedelta

        old_login_time = datetime.now() - timedelta(days=1)
        existing_user.last_login = old_login_time
        existing_user.save()

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
            json={"email": "google_user@example.com", "email_verified": True},
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "code": "valid_google_code"},
            }
        }

        # Verify user exists before login attempt
        user_before = User.objects.get(username="google_user")
        self.assertEqual(user_before.id, existing_user.id)

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

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
                "attributes": {"provider": "facebook", "code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        # Should return 400 with unsupported provider error
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertEqual(
            response_data["errors"]["error"], "Unsupported provider: facebook"
        )

    def test_integrated_oauth_invalid_serializer_data(self):
        self.auth_user_api_client = APIClient()
        # Missing provider field
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @responses.activate
    def test_integrated_oauth_github_invalid_token_response(self):
        # Mock GitHub OAuth token endpoint with error
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="error=invalid_request&error_description=Invalid+code",
            status=400,
            content_type="application/x-www-form-urlencoded",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "invalid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_google_invalid_token_response(self):
        # First mock the userinfo endpoint to fail (for direct token case)
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"error": "invalid_token"},
            status=401,
            content_type="application/json",
        )

        # Then mock Google OAuth token endpoint with error (for code exchange case)
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
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "code": "invalid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_google_direct_access_token_flow(self):
        """Test that Google login works with direct access token (iOS native auth case)"""
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
                "attributes": {"provider": "google", "code": "direct_access_token"},
            }
        }

        # Test to make sure the user doesn't exist before the login
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="native_user")

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        user = User.objects.get(username="native_user")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(user.login_count, 1)

    @responses.activate
    def test_integrated_oauth_github_user_fetch_failure(self):
        # Mock GitHub OAuth token endpoint
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=test_access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )

        # Mock GitHub user endpoint with error
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"message": "Bad credentials"},
            status=401,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_github_missing_username(self):
        # Mock GitHub OAuth token endpoint
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=test_access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )

        # Mock GitHub user endpoint without login field
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"id": 12345, "name": "Test User"},  # Missing "login" field
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_github_emails_fetch_failure(self):
        # Mock GitHub OAuth token endpoint
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=test_access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )

        # Mock GitHub user endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"login": "testuser"},
            status=200,
            content_type="application/json",
        )

        # Mock GitHub emails endpoint with error
        responses.add(
            responses.GET,
            "https://api.github.com/user/emails",
            json={"message": "Requires authentication"},
            status=401,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_github_missing_primary_email(self):
        # Mock GitHub OAuth token endpoint
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=test_access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )

        # Mock GitHub user endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"login": "testuser"},
            status=200,
            content_type="application/json",
        )

        # Mock GitHub emails endpoint without primary email
        responses.add(
            responses.GET,
            "https://api.github.com/user/emails",
            json=[
                {"email": "user@example.com", "primary": False, "verified": True}
            ],  # No primary email
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_github_missing_access_token(self):
        # Mock GitHub OAuth token endpoint without access_token
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="error=invalid_request&error_description=Invalid+code",
            status=200,  # GitHub returns 200 even for errors
            content_type="application/x-www-form-urlencoded",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "github", "code": "invalid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_google_missing_email(self):
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
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "code": "valid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @responses.activate
    def test_integrated_oauth_google_user_info_fetch_failure_after_token_exchange(self):
        # First mock userinfo to fail (direct token case)
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
                "access_token": "new_access_token",
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
            "data": {
                "type": "IntegratedOAuthLogin",
                "attributes": {"provider": "google", "code": "invalid_code"},
            }
        }

        response = self.auth_user_api_client.post("/api/v1/oauth/", payload)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)
