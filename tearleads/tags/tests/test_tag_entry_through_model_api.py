import pprint

from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TagFactory, TagTextEntryThroughModelFactory


class TestTagsEntriesApi(BaseTestCase):
    def setUp(self):
        super(TestTagsEntriesApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsEntriesApi, cls).setUpTestData()

    def test_retrieve_fails(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            tag=tag, text_entry=text_entry, user=self.user1
        )
        response = self.user1_api_client.get(
            "/api/v1/tags_entries/" + str(tag_text_entry.id)
        )
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_list_fails(self):
        response = self.user1_api_client.get("/api/v1/tags_entries")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_can_tag_self_owned(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        payload = {
            "data": {
                "type": "TagTextEntryThroughModel",
                "attributes": {},
                "relationships": {
                    "tag": {"data": {"type": "Tag", "id": tag.id}},
                    "text_entry": {"data": {"type": "TextEntry", "id": text_entry.id}},
                },
            }
        }
        response = self.user1_api_client.post(
            "/api/v1/tags_entries", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_requires_authentication(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        payload = {}
        response = self.unauthenticated_user_api_client.post(
            "/api/v1/tags_entries", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "Authentication credentials were not provided.",
        )

    def test_reorder_requires_authentication(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        payload = {}
        response = self.unauthenticated_user_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "Authentication credentials were not provided.",
        )

    def test_reorder_works(self):
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1)
        tag_entry1 = TagTextEntryThroughModelFactory(
            text_entry=entry1, tag=tag1, user=self.user1, order=1
        )
        tag_entry1_timestamp = tag_entry1.date_updated
        tag_entry2 = TagTextEntryThroughModelFactory(
            text_entry=entry2, tag=tag1, user=self.user1, order=2
        )
        tag_entry2_timestamp = tag_entry2.date_updated
        payload = {
            "data": {
                "type": "TagTextEntryThroughModel",
                "attributes": {"top": tag_entry2.id, "bottom": tag_entry1.id},
                "relationships": {},
            }
        }

        self.assertLess(tag_entry1.order, tag_entry2.order)
        response = self.user1_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        tag_entry1.refresh_from_db()
        tag_entry2.refresh_from_db()
        self.assertNotEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertNotEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        self.assertLess(tag_entry2.order, tag_entry1.order)

    def test_reorder_fails_if_not_top_owner(self):
        entry1 = TextEntryFactory(user=self.user2)
        entry2 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1)
        tag_entry1 = TagTextEntryThroughModelFactory(
            text_entry=entry1, tag=tag1, user=self.user2, order=1
        )
        tag_entry1_timestamp = tag_entry1.date_updated
        tag_entry2 = TagTextEntryThroughModelFactory(
            text_entry=entry2, tag=tag1, user=self.user1, order=2
        )
        tag_entry2_timestamp = tag_entry2.date_updated
        payload = {
            "data": {
                "type": "TagTextEntryThroughModel",
                "attributes": {"top": tag_entry2.id, "bottom": tag_entry1.id},
                "relationships": {},
            }
        }

        self.assertLess(tag_entry1.order, tag_entry2.order)
        response = self.user1_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        tag_entry1.refresh_from_db()
        tag_entry2.refresh_from_db()
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        self.assertLess(tag_entry1.order, tag_entry2.order)

    def test_reorder_fails_if_not_bottom_owner(self):
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user2)
        tag1 = TagFactory(user=self.user1)
        tag_entry1 = TagTextEntryThroughModelFactory(
            text_entry=entry1, tag=tag1, user=self.user1, order=1
        )
        tag_entry1_timestamp = tag_entry1.date_updated
        tag_entry2 = TagTextEntryThroughModelFactory(
            text_entry=entry2, tag=tag1, user=self.user2, order=2
        )
        tag_entry2_timestamp = tag_entry2.date_updated
        payload = {
            "data": {
                "type": "TagTextEntryThroughModel",
                "attributes": {"top": tag_entry2.id, "bottom": tag_entry1.id},
                "relationships": {},
            }
        }

        self.assertLess(tag_entry1.order, tag_entry2.order)
        response = self.user1_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        tag_entry1.refresh_from_db()
        tag_entry2.refresh_from_db()
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        self.assertLess(tag_entry1.order, tag_entry2.order)
