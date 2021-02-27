from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase

from tearleads.core.tests.core import BaseTestCase

from tearleads.mock import api as mock_google_api


class TestMockGoogleOAuthApi(APITestCase):
    def setUp(self):
        super(TestMockGoogleOAuthApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        cls.unauthenticated_user_api_client = APIClient()
        super(TestMockGoogleOAuthApi, cls).setUpTestData()

    def test_oauth_access_token(self):
        payload = {
            "token": "mock_valid_token",
            "code": "mock_valid_code",
            "client_secret": "mock_valid_client_secret",
        }
        response = self.unauthenticated_user_api_client.post(
            "/mock/google/oauth2/access_token", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        json_response = response.json()
        self.assertEqual(json_response["data"]["access_token"], "valid_access_token")

    def test_oauth_email(self):
        valid_access_token = "valid_access_token"
        response = self.unauthenticated_user_api_client.post(
            "/mock/google/oauth2/access_token", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        json_response = response.json()
        self.assertEqual(json_response["data"]["access_token"], "valid_access_token")
