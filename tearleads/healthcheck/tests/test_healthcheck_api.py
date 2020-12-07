from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase


class TestHealthCheckApi(BaseTestCase):
    def setUp(self):
        super(TestHealthCheckApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestHealthCheckApi, cls).setUpTestData()

    def test_health_check(self):
        response = self.user1_api_client.get("/healthcheck/", format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
