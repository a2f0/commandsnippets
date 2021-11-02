import time
from unittest import skip
from urllib.parse import parse_qs

import httpretty
from django.contrib.staticfiles.testing import LiveServerTestCase
from httpretty import httprettified
from rest_framework.test import APIClient

from tearleads.authentication.services import GithubOAuthService
from tearleads.core.tests.core import BaseTestCase


class TestGithubAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGithubAuthentication, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestGithubAuthentication, cls).setUpTestData()

    @httprettified
    def test_access_token(self):
        service = GithubOAuthService()
        httpretty.register_uri(
            httpretty.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=access_token&scope=user%3Aemail&token_type=bearer",
        )
        response = service.access_token(code="code")
        qs = parse_qs(response.text)
        self.assertEqual(qs["access_token"][0], "access_token")

    @httprettified
    def test_user(self):
        service = GithubOAuthService()
        httpretty.register_uri(
            httpretty.GET, "https://api.github.com/user", body='{"login": "login"}'
        )
        response = service.user(access_token="access_token")
        self.assertEqual(response.json(), {"login": "login"})

    @httprettified
    def test_emails(self):
        service = GithubOAuthService()
        httpretty.register_uri(
            httpretty.GET,
            "https://api.github.com/user/emails",
            body='[{"email":"user@example.com","primary":true}]',
        )
        response = service.emails(access_token="access_token")
        self.assertEqual(
            response.json(), [{"email": "user@example.com", "primary": True}]
        )
