from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase


class TestUsersApi(BaseTestCase):
    def setUp(self):
        super(TestUsersApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestUsersApi, cls).setUpTestData()

    def test_serialization_format(self):
        tag = self.user1.tags.all().first()

        response = self.user1_api_client.get("/api/v1/user/")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 3)
        self.assertEqual(json_response["data"]["type"], "User")
        self.assertEqual(json_response["data"]["id"], str(self.user1.id))
        self.assertEqual(len(json_response["data"]["attributes"]), 2)
        self.assertEqual(
            json_response["data"]["attributes"]["username"], str(self.user1.username)
        )
        self.assertEqual(
            json_response["data"]["attributes"]["date_updated"],
            str(self.user1.date_updated.isoformat()),
        )
