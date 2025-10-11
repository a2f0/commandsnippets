from rest_framework import status

from tearleads.core.tests.core import BaseTestCase
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TextEntryReusedFactory


class TestTagsEntriesApi(BaseTestCase):
    def setUp(self):
        super(TestTagsEntriesApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsEntriesApi, cls).setUpTestData()

    def test_serialization_format(self):
        text_entry = TextEntryFactory(user=self.user1)
        text_entry_reused = TextEntryReusedFactory(
            text_entry=text_entry, user=self.user1
        )
        response = self.user1_api_client.get(
            "/api/v1/entry_reuses/" + str(text_entry_reused.id)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response["data"]["id"], str(text_entry_reused.id))
        self.assertEqual(json_response["data"]["type"], "TextEntryReused")
        self.assertEqual(
            json_response["data"]["relationships"]["text_entry"]["data"]["id"],
            str(text_entry.id),
        )
        self.assertEqual(
            json_response["data"]["relationships"]["text_entry"]["data"]["type"],
            "TextEntry",
        )
        self.assertEqual(
            json_response["data"]["relationships"]["user"]["data"]["id"],
            str(self.user1.id),
        )
        self.assertEqual(
            json_response["data"]["relationships"]["user"]["data"]["type"], "User"
        )

    def test_can_reuse_self_owned(self):
        text_entry = TextEntryFactory(user=self.user1)
        payload = {
            "data": {
                "type": "TextEntryReused",
                "attributes": {},
                "relationships": {
                    "text_entry": {"data": {"type": "TextEntry", "id": text_entry.id}},
                },
            }
        }
        self.assertEqual(text_entry.reused_count, 0)
        response = self.user1_api_client.post(
            "/api/v1/entry_reuses", payload, format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.reused_count, 1)

    def test_can_delete_self_owned_reuse(self):
        text_entry = TextEntryFactory(user=self.user1)
        text_entry_reused = TextEntryReusedFactory(
            text_entry=text_entry, user=self.user1
        )
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.reused_count, 1)
        response = self.user1_api_client.delete(
            "/api/v1/entry_reuses/" + str(text_entry_reused.id), format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.reused_count, 0)

    def test_cannot_delete_owned_by_other(self):
        text_entry = TextEntryFactory(user=self.user2)
        text_entry_reused = TextEntryReusedFactory(
            text_entry=text_entry, user=self.user2
        )
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.reused_count, 1)
        response = self.user1_api_client.delete(
            "/api/v1/entry_reuses/" + str(text_entry_reused.id), format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reuse_requires_authentication(self):
        text_entry = TextEntryFactory(user=self.user1)
        payload = {
            "data": {
                "type": "TextEntryReused",
                "attributes": {},
                "relationships": {
                    "text_entry": {"data": {"type": "TextEntry", "id": text_entry.id}},
                },
            }
        }
        response = self.unauthenticated_user_api_client.post(
            "/api/v1/entry_reuses", payload, format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bad_filter(self):
        response = self.user1_api_client.get("/api/v1/entry_reuses?filter[bad]=1")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(json_response["errors"][0]["detail"], "invalid filter[bad]")
