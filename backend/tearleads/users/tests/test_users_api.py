import configparser

from rest_framework import status
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase

config = configparser.RawConfigParser()
config.read("setup.cfg")


class TestUsersApi(BaseTestCase):
    def setUp(self):
        super(TestUsersApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestUsersApi, cls).setUpTestData()

    def test_serialization_format(self):
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

    def test_unauthenticated_user(self):
        self.auth_user_api_client = APIClient()
        response = self.auth_user_api_client.get("/api/v1/user/", format="json")
        json_response = response.json()
        self.assertEqual(
            response.headers["API-Version"], config["bumpversion"]["current_version"]
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(len(json_response["errors"]), 0)
