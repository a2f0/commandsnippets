from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TagFactory, TagTextEntryThroughModelFactory


class TestTagsApi(BaseTestCase):
    def setUp(self):
        super(TestTagsApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsApi, cls).setUpTestData()

    def test_serialization_format(self):
        tag = TagFactory(user=self.user1)
        response = self.user1_api_client.get("/api/v1/tags")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()["data"]), 1)
        self.assertEqual(response.json()["data"][0]["id"], str(tag.id))
        self.assertEqual(response.json()["data"][0]["attributes"]["name"], tag.name)
        self.assertEqual(
            response.json()["data"][0]["attributes"]["date_created"],
            str(tag.date_created.isoformat()),
        )
        self.assertEqual(
            response.json()["data"][0]["attributes"]["date_updated"],
            str(tag.date_updated.isoformat()),
        )
        self.assertEqual(len(response.json()["included"]), 1)
        self.assertEqual(response.json()["included"][0]["type"], "User")
        self.assertEqual(len(response.json()["included"][0]["attributes"]), 1)
        self.assertEqual(
            response.json()["included"][0]["attributes"]["username"],
            self.user1.username,
        )

    def test_order_filter(self):
        tag1 = TagFactory(user=self.user1, name="a", entry_count=0)
        tag2 = TagFactory(user=self.user1, name="z", entry_count=1)

        tag1_entry = TagTextEntryThroughModelFactory(tag=tag1, user=self.user1)
        tag2_entry = TagTextEntryThroughModelFactory(tag=tag2, user=self.user1)

        entry = TextEntryFactory(user=self.user1)

        # invalid sort key
        response = self.user1_api_client.get("/api/v1/tags?sort=invalid_sort_key")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "invalid sort parameter: invalid_sort_key",
        )

        # sort by name
        response = self.user1_api_client.get("/api/v1/tags?sort=name")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # reverse sort by name
        response = self.user1_api_client.get("/api/v1/tags?sort=-name")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

        # sort by date_created
        response = self.user1_api_client.get("/api/v1/tags?sort=date_created")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # reverse sort by date_created
        response = self.user1_api_client.get("/api/v1/tags?sort=-date_created")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

        # sort by entry_count
        response = self.user1_api_client.get("/api/v1/tags?sort=entry_count")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # reverse sort by entry_count
        response = self.user1_api_client.get("/api/v1/tags?sort=-entry_count")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

        # sort by date_last_used
        response = self.user1_api_client.get("/api/v1/tags?sort=date_last_used")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # reverse sort by date_last_used
        response = self.user1_api_client.get("/api/v1/tags?sort=-date_last_used")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

    def test_pagination(self):
        tag1 = TagFactory(user=self.user1, name="a")
        tag2 = TagFactory(user=self.user1, name="z")

        response = self.user1_api_client.get("/api/v1/tags?page[number]=1&page[size]=1")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))

        response = self.user1_api_client.get("/api/v1/tags?page[number]=2&page[size]=1")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))

    def test_create_requires_authentication(self):
        payload = {}
        response = self.unauthenticated_user_api_client.post(
            "/api/v1/tags", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "Authentication credentials were not provided.",
        )

    def test_can_create_self_owned(self):
        payload = {"data": {"type": "Tag", "attributes": {"name": "new tag"}}}
        response = self.user1_api_client.post(
            "/api/v1/tags", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            json_response["data"]["attributes"]["name"],
            payload["data"]["attributes"]["name"],
        )
        self.assertEqual(len(response.json()["included"]), 1)
        self.assertEqual(response.json()["included"][0]["type"], "User")
        self.assertEqual(len(response.json()["included"][0]["attributes"]), 1)
        self.assertEqual(
            response.json()["included"][0]["attributes"]["username"],
            self.user1.username,
        )
