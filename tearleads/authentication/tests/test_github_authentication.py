import time
from unittest import skip

import httpretty
from django.contrib.staticfiles.testing import LiveServerTestCase
from rest_framework import status
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase


class TestGithubAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGithubAuthentication, self).setUp()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()

    @httpretty.activate(verbose=True, allow_net_connect=False)
    def test_successful_github_login(self):
        self.auth_user_api_client = APIClient()
        httpretty.register_uri(
            httpretty.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=access_token&scope=user%3Aemail&token_type=bearer",
        )
        httpretty.register_uri(
            httpretty.GET, "https://api.github.com/user", body='{"login": "login"}'
        )
        httpretty.register_uri(
            httpretty.GET,
            "https://api.github.com/user/emails",
            body='[{"email":"user@example.com","primary":true}]',
        )
        payload = {
            "data": {"type": "GithubLogin", "attributes": {"code": "valid_code"}}
        }
        response = self.auth_user_api_client.post("/api/v1/github-login/", payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertNotEqual(
            self.auth_user_api_client.cookies["Authorization"].value, ""
        )
