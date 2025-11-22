import os
from urllib.parse import parse_qs

import responses

from tearleads.authentication.services import GithubOAuthService
from tearleads.core.tests.core import BaseTestCase


class TestGithubAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGithubAuthentication, self).setUp()
        os.environ["GITHUB_CLIENT_ID"] = "test_client_id"
        os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret"
        os.environ["GITHUB_REDIRECT_URI"] = "https://example.com/callback"

    @classmethod
    def setUpTestData(cls):
        super(TestGithubAuthentication, cls).setUpTestData()

    @responses.activate
    def test_access_token(self):
        service = GithubOAuthService()
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="access_token=access_token&scope=user%3Aemail&token_type=bearer",
            status=200,
            content_type="application/x-www-form-urlencoded",
        )
        response = service.access_token(code="code")
        qs = parse_qs(response.text)
        self.assertEqual(qs["access_token"][0], "access_token")

        request_body = responses.calls[0].request.body
        sent_data = parse_qs(request_body)
        self.assertIn("redirect_uri", sent_data)
        self.assertEqual(sent_data["redirect_uri"][0], "https://example.com/callback")
        self.assertEqual(sent_data["client_id"][0], "test_client_id")
        self.assertEqual(sent_data["client_secret"][0], "test_client_secret")
        self.assertEqual(sent_data["code"][0], "code")

    @responses.activate
    def test_user(self):
        service = GithubOAuthService()
        responses.add(
            responses.GET,
            "https://api.github.com/user",
            json={"login": "login"},
            status=200,
            content_type="application/json",
        )
        response = service.user(access_token="access_token")
        self.assertEqual(response.json(), {"login": "login"})

    @responses.activate
    def test_emails(self):
        service = GithubOAuthService()
        responses.add(
            responses.GET,
            "https://api.github.com/user/emails",
            json=[{"email": "user@example.com", "primary": True}],
            status=200,
            content_type="application/json",
        )
        response = service.emails(access_token="access_token")
        self.assertEqual(
            response.json(), [{"email": "user@example.com", "primary": True}]
        )
