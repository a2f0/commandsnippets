from rest_framework import status

from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.models import TagTextEntryThroughModel
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
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_requires_authentication(self):
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
        """Test that reordering tag entries works correctly."""
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

        # Verify initial state
        self.assertLess(tag_entry1.order, tag_entry2.order)

        # Perform reorder
        response = self.user1_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify timestamps were updated
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        tag_entry1.refresh_from_db()
        tag_entry2.refresh_from_db()
        self.assertNotEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertNotEqual(tag_entry2_timestamp, tag_entry2.date_updated)

        # Verify order was changed
        self.assertLess(tag_entry2.order, tag_entry1.order)

    def test_reorder_fails_if_not_top_owner(self):
        """Test that reordering fails when user doesn't own the top entry."""
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

        # Verify initial state
        self.assertLess(tag_entry1.order, tag_entry2.order)

        # Attempt reorder (should fail)
        response = self.user1_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Verify timestamps were NOT updated
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        tag_entry1.refresh_from_db()
        tag_entry2.refresh_from_db()
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)

        # Verify order was NOT changed
        self.assertLess(tag_entry1.order, tag_entry2.order)

    def test_reorder_fails_if_not_bottom_owner(self):
        """Test that reordering fails when user doesn't own the bottom entry."""
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

        # Verify initial state
        self.assertLess(tag_entry1.order, tag_entry2.order)

        # Attempt reorder (should fail)
        response = self.user1_api_client.post(
            "/api/v1/tags_entries/reorder", payload, format="vnd.api+json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Verify timestamps were NOT updated
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)
        tag_entry1.refresh_from_db()
        tag_entry2.refresh_from_db()
        self.assertEqual(tag_entry1_timestamp, tag_entry1.date_updated)
        self.assertEqual(tag_entry2_timestamp, tag_entry2.date_updated)

        # Verify order was NOT changed
        self.assertLess(tag_entry1.order, tag_entry2.order)

    def test_delete_requires_authentication(self):
        """Test that deleting a tag-text entry relationship requires authentication."""
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            tag=tag, text_entry=text_entry, user=self.user1
        )
        response = self.unauthenticated_user_api_client.delete(
            f"/api/v1/tags_entries/{tag_text_entry.id}"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "Authentication credentials were not provided.",
        )
        self.assertTrue(TagTextEntryThroughModel.objects.filter(id=tag_text_entry.id).exists())

    def test_delete_succeeds_when_user_owns_relationship(self):
        """Test that a user can delete a tag-text entry relationship they own."""
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            tag=tag, text_entry=text_entry, user=self.user1
        )

        # Verify the relationship exists
        self.assertTrue(
            TagTextEntryThroughModel.objects.filter(id=tag_text_entry.id).exists()
        )

        response = self.user1_api_client.delete(
            f"/api/v1/tags_entries/{tag_text_entry.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify the relationship was deleted
        self.assertFalse(
            TagTextEntryThroughModel.objects.filter(id=tag_text_entry.id).exists()
        )

    def test_delete_fails_when_user_doesnt_own_relationship(self):
        """Test that a user cannot delete a tag-text entry relationship
        they don't own."""
        # Create a relationship owned by user2
        tag = TagFactory(user=self.user2)
        text_entry = TextEntryFactory(user=self.user2)
        tag_text_entry = TagTextEntryThroughModelFactory(
            tag=tag, text_entry=text_entry, user=self.user2
        )

        # Verify the relationship exists
        self.assertTrue(
            TagTextEntryThroughModel.objects.filter(id=tag_text_entry.id).exists()
        )

        # Try to delete as user1 (should fail)
        response = self.user1_api_client.delete(
            f"/api/v1/tags_entries/{tag_text_entry.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Verify the relationship still exists
        self.assertTrue(
            TagTextEntryThroughModel.objects.filter(id=tag_text_entry.id).exists()
        )
