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

    def test_health_check(self):
        response = self.unauthenticated_user_api_client.post(
            "/mock/google/oauth/access_token", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
