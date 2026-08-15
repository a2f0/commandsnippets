from django.conf import settings
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase
from tearleads.users.models import User
from tearleads.users.tests.factories import UserFactory


class TestAuthentication(BaseTestCase):
    def setUp(self):
        super(TestAuthentication, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestAuthentication, cls).setUpTestData()

    def _assert_logout_response_is_ok(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_successful_authentication_then_deauthentication(self):
        self.auth_user = UserFactory()
        existing_token = Token.objects.get(user=self.auth_user)
        self.auth_user_api_client = APIClient()
        payload = {"username": self.auth_user.username, "password": "password"}
        response = self.auth_user_api_client.post(
            "/api-token-auth/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.cookies["Authorization"].value,
            Token.objects.filter(user=self.auth_user)[0].key,
        )
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
        self.assertEqual(
            self.auth_user_api_client.cookies["Authorization"].value,
            Token.objects.filter(user=self.auth_user)[0].key,
        )
        response = self.auth_user_api_client.post("/api-token-deauth/", format="json")

        self._assert_logout_response_is_ok(response)

        # Make sure the token still exists after de-authenticating.
        # The reason this persists is because the current authentication
        # system is one token per-user only.
        # This will cause an issue if a user logs out of one browser
        # because the existing token would be destroyed and a new one
        # provisioned upon next login.
        existing_token.refresh_from_db()
        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertEqual("LoggedIn" in self.auth_user_api_client.cookies, True)
        self.assertEqual(self.auth_user_api_client.cookies["Authorization"].value, "")
        self.assertEqual(self.auth_user_api_client.cookies["LoggedIn"]["max-age"], 0)

    def test_failed_authentication(self):
        payload = {"username": "user1", "password": "wrongpassword"}
        response = self.user1_api_client.post(
            "/api-token-auth/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_blank_passwords_not_allowed(self):
        user, created = User.objects.get_or_create(
            email="user@example.com", username="user"
        )
        self.assertEqual(user.password, "")
        self.assertNotEqual(user.id, None)
        self.auth_user_api_client = APIClient()
        # password as empty string
        payload = {"username": "user", "password": ""}
        response = self.auth_user_api_client.post(
            "/api-token-auth/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # password attribute missing
        payload = {"username": "user"}
        response = self.auth_user_api_client.post(
            "/api-token-auth/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # password as None
        payload = {"username": "user", "password": None}
        response = self.auth_user_api_client.post(
            "/api-token-auth/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_token_passed_to_logout(self):
        self.auth_user = UserFactory()
        self.auth_user_api_client = APIClient()
        self.auth_user_api_client.cookies["Authorization"] = "invalid_token"
        response = self.auth_user_api_client.post("/api-token-deauth/", format="json")

        self._assert_logout_response_is_ok(response)

        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertEqual("LoggedIn" in self.auth_user_api_client.cookies, True)
        self.assertEqual(self.auth_user_api_client.cookies["Authorization"].value, "")
