import responses

from tearleads.authentication.services import GoogleOAuthService
from tearleads.core.tests.core import BaseTestCase


class TestGoogleAuthentication(BaseTestCase):
    def setUp(self):
        super(TestGoogleAuthentication, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestGoogleAuthentication, cls).setUpTestData()

    @responses.activate
    def test_access_token(self):
        service = GoogleOAuthService()
        responses.add(
            responses.POST,
            "https://oauth2.googleapis.com/token",
            json={"access_token": "access_token"},
            status=200,
            content_type="application/json",
        )
        response = service.access_token(code="code")
        self.assertEqual(response.json(), {"access_token": "access_token"})

    @responses.activate
    def test_user(self):
        service = GoogleOAuthService()
        responses.add(
            responses.GET,
            "https://www.googleapis.com/oauth2/v3/userinfo",
            json={"email": "user@example.com"},
            status=200,
            content_type="application/json",
        )
        response = service.user(access_token="access_token")
        self.assertEqual(response.json(), {"email": "user@example.com"})
