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


class TestGithubAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGithubAuthentication, self).setUp()
        # Set up environment variables needed by the service
        os.environ["GITHUB_CLIENT_ID"] = "test_client_id"
        os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret"

    @responses.activate
    def test_successful_github_login_for_new_user(self):
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
            json={"login": "login"},
            status=200,
            content_type="application/json",
        )

        # Mock GitHub emails endpoint
        responses.add(
            responses.GET,
            "https://api.github.com/user/emails",
            json=[{"email": "user@example.com", "primary": True, "verified": True}],
            status=200,
            content_type="application/json",
        )

        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GithubLogin", "attributes": {"code": "valid_code"}}
        }

        # test to make sure the user doesnt exist before the login.
        with self.assertRaises(User.DoesNotExist):
            user = User.objects.get(username="login")

        response = self.auth_user_api_client.post("/api/v1/github-login/", payload)

        user = User.objects.get(username="login")
        self.assertEqual(user.last_login, None)
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
