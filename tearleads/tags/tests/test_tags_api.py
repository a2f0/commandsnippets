from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.models import Tag
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TagFactory, TagTextEntryThroughModelFactory


class TestTagsApi(BaseTestCase):
    def setUp(self):
        super(TestTagsApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsApi, cls).setUpTestData()

    def test_serialization_format(self):
        """Test the complete serialization format including main tag data and included user."""
        tag = self.user1.tags.all().first()

        response = self.user1_api_client.get(
            "/api/v1/tags?&filter[user.username]={}".format(self.user1.username)
        )
        json_response = response.json()

        # Test main response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = json_response["data"]
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["id"], str(tag.id))

        # Test main tag attributes
        attributes = data[0]["attributes"]
        self.assertEqual(len(attributes), 7)
        self.assertEqual(attributes["name"], tag.name)
        self.assertEqual(attributes["date_created"], str(tag.date_created.isoformat()))
        self.assertEqual(attributes["date_updated"], str(tag.date_updated.isoformat()))
        self.assertEqual(
            attributes["date_last_used"], str(tag.date_last_used.isoformat())
        )
        self.assertEqual(attributes["is_deleted"], False)
        self.assertEqual(attributes["entry_count"], tag.entry_count)
        self.assertEqual(attributes["order"], tag.order)

        # Test included user data
        included = json_response["included"]
        self.assertEqual(len(included), 1)
        user_data = included[0]
        self.assertEqual(user_data["type"], "User")
        self.assertEqual(len(user_data["attributes"]), 2)
        self.assertEqual(user_data["attributes"]["username"], self.user1.username)
        self.assertEqual(
            user_data["attributes"]["date_updated"],
            str(self.user1.date_updated.isoformat()),
        )

    def test_pagination(self):
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()

        self.assertEqual(self.user1.tags.count(), 2)

        response = self.user1_api_client.get(
            "/api/v1/tags?page[number]=1&page[size]=1&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["meta"]["pagination"]["count"], 2)

        response = self.user1_api_client.get(
            "/api/v1/tags?page[number]=2&page[size]=1&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["meta"]["pagination"]["count"], 2)

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

    def test_name_too_large(self):
        max_length = Tag._meta.get_field("name").max_length
        too_large = max_length + 1
        oversized_name = "x" * too_large
        payload = {"data": {"type": "Tag", "attributes": {"name": oversized_name}}}
        response = self.user1_api_client.post(
            "/api/v1/tags", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            f"Ensure this field has no more than {24} characters.",
        )

    def test_can_create_self_owned(self):
        """Test that users can create tags they own."""
        payload = {"data": {"type": "Tag", "attributes": {"name": "new tag"}}}
        response = self.user1_api_client.post(
            "/api/v1/tags", payload, format="vnd.api+json"
        )
        json_response = response.json()

        # Test main response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = json_response["data"]
        self.assertEqual(
            data["attributes"]["name"],
            payload["data"]["attributes"]["name"],
        )

        # Test included user data
        included = json_response["included"]
        self.assertEqual(len(included), 1)
        user_data = included[0]
        self.assertEqual(user_data["type"], "User")
        self.assertEqual(len(user_data["attributes"]), 2)
        self.assertEqual(user_data["attributes"]["username"], self.user1.username)
        self.assertEqual(
            user_data["attributes"]["date_updated"],
            str(self.user1.date_updated.isoformat()),
        )

    def test_can_resurrect_self_owned(self):
        """Test that users can resurrect deleted tags they own."""
        deleted_tag = TagFactory(user=self.user1, name="deleted tag", is_deleted=True)
        payload = {"data": {"type": "Tag", "attributes": {"name": "deleted tag"}}}
        response = self.user1_api_client.post(
            "/api/v1/tags", payload, format="vnd.api+json"
        )
        json_response = response.json()

        # Test main response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = json_response["data"]
        self.assertEqual(
            data["attributes"]["name"],
            payload["data"]["attributes"]["name"],
        )
        self.assertEqual(data["id"], str(deleted_tag.id))

        # Test included user data
        included = json_response["included"]
        self.assertEqual(len(included), 1)
        user_data = included[0]
        self.assertEqual(user_data["type"], "User")
        self.assertEqual(len(user_data["attributes"]), 2)
        self.assertEqual(user_data["attributes"]["username"], self.user1.username)
        self.assertEqual(
            user_data["attributes"]["date_updated"],
            str(self.user1.date_updated.isoformat()),
        )

    def test_delete_works_when_self_owns_object(self):
        """Test that deletion works when the user owns the tag."""
        tag = TagFactory(user=self.user1, name="deleted tag", is_deleted=False)
        response = self.user1_api_client.delete(
            "/api/v1/tags/" + str(tag.id), format="vnd.api+json"
        )
        json_response = response.json()

        # Test main response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = json_response["data"]
        self.assertEqual(data["attributes"]["is_deleted"], True)

        # Test included user data
        included = json_response["included"]
        self.assertEqual(len(included), 1)
        user_data = included[0]
        self.assertEqual(user_data["type"], "User")
        self.assertEqual(len(user_data["attributes"]), 2)
        self.assertEqual(user_data["attributes"]["username"], self.user1.username)
        self.assertEqual(
            user_data["attributes"]["date_updated"],
            str(self.user1.date_updated.isoformat()),
        )

    def test_delete_fails_when_object_owned_by_other(self):
        tag = TagFactory(user=self.user2, name="deleted tag", is_deleted=False)
        response = self.user1_api_client.delete(
            "/api/v1/tags/" + str(tag.id), format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "You do not have permission to perform this action.",
        )

    def test_reorder_works(self):
        tag1 = TagFactory(user=self.user1, order=1)
        tag1_timestamp = tag1.date_updated
        tag2 = TagFactory(user=self.user1, order=2)
        tag2_timestamp = tag2.date_updated
        payload = {
            "data": {
                "type": "Tag",
                "attributes": {"top": tag2.id, "bottom": tag1.id},
                "relationships": {},
            }
        }

        self.assertLess(tag1.order, tag2.order)
        response = self.user1_api_client.post(
            "/api/v1/tags/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(tag1_timestamp, tag1.date_updated)
        self.assertEqual(tag2_timestamp, tag2.date_updated)
        tag1.refresh_from_db()
        tag2.refresh_from_db()
        self.assertNotEqual(tag1_timestamp, tag1.date_updated)
        self.assertNotEqual(tag2_timestamp, tag2.date_updated)
        self.assertLess(tag2.order, tag1.order)

    def test_reorder_fails_if_not_bottom_owner(self):
        tag1 = TagFactory(user=self.user2, order=1)
        tag1_timestamp = tag1.date_updated
        tag2 = TagFactory(user=self.user1, order=2)
        tag2_timestamp = tag2.date_updated
        payload = {
            "data": {
                "type": "Tag",
                "attributes": {"top": tag2.id, "bottom": tag1.id},
                "relationships": {},
            }
        }

        self.assertLess(tag1.order, tag2.order)
        response = self.user1_api_client.post(
            "/api/v1/tags/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(tag1_timestamp, tag1.date_updated)
        self.assertEqual(tag2_timestamp, tag2.date_updated)
        tag1.refresh_from_db()
        tag2.refresh_from_db()
        self.assertEqual(tag1_timestamp, tag1.date_updated)
        self.assertEqual(tag2_timestamp, tag2.date_updated)
        self.assertLess(tag1.order, tag2.order)

    def test_reorder_fails_if_not_tio_owner(self):
        tag1 = TagFactory(user=self.user1, order=1)
        tag1_timestamp = tag1.date_updated
        tag2 = TagFactory(user=self.user2, order=2)
        tag2_timestamp = tag2.date_updated
        payload = {
            "data": {
                "type": "Tag",
                "attributes": {"top": tag2.id, "bottom": tag1.id},
                "relationships": {},
            }
        }

        self.assertLess(tag1.order, tag2.order)
        response = self.user1_api_client.post(
            "/api/v1/tags/reorder", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(tag1_timestamp, tag1.date_updated)
        self.assertEqual(tag2_timestamp, tag2.date_updated)
        tag1.refresh_from_db()
        tag2.refresh_from_db()
        self.assertEqual(tag1_timestamp, tag1.date_updated)
        self.assertEqual(tag2_timestamp, tag2.date_updated)
        self.assertLess(tag1.order, tag2.order)

    def test_bad_filter(self):
        response = self.user1_api_client.get("/api/v1/tags?filter[bad]=1")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(json_response["errors"][0]["detail"], "invalid filter[bad]")

    def test_filter_by_user_name(self):
        """Test filtering tags by username."""
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()

        # Test filtering by valid username
        response = self.user1_api_client.get(
            "/api/v1/tags?filter[user.username]={}".format(self.user1.username)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = json_response["data"]
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["id"], str(tag1.id))
        self.assertEqual(data[1]["id"], str(tag2.id))

        # Test filtering by invalid username
        response = self.user1_api_client.get(
            "/api/v1/tags?filter[user.username]=random"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 0)

    def test_filter_by_date_updated_gt(self):
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()
        response = self.user1_api_client.get(
            "/api/v1/tags?filter[date_updated.gt]={}&filter[user.username]={}".format(
                tag1.date_updated, self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))

    def test_order_filter(self):
        """Test various sorting options for tags."""
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()

        # Test invalid sort key
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=invalid_sort_key&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "invalid sort parameter: invalid_sort_key",
        )

        # Test sorting by different fields
        sort_tests = [
            # (sort_param, expected_first_id, expected_second_id)
            ("date_created", tag1.id, tag2.id),
            ("-date_created", tag2.id, tag1.id),
            ("date_updated", tag1.id, tag2.id),
            ("-date_updated", tag2.id, tag1.id),
            ("order", tag1.id, tag2.id),
            ("-order", tag2.id, tag1.id),
            ("name", tag1.id, tag2.id),
            ("-name", tag2.id, tag1.id),
        ]

        for sort_param, expected_first_id, expected_second_id in sort_tests:
            response = self.user1_api_client.get(
                "/api/v1/tags?sort={}&filter[user.username]={}".format(
                    sort_param, self.user1.username
                )
            )
            json_response = response.json()
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            data = json_response["data"]
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]["id"], str(expected_first_id))
            self.assertEqual(data[1]["id"], str(expected_second_id))

    def test_inequality_operator(self):
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()

        response = self.user1_api_client.get(
            "/api/v1/tags?sort=-date_updated&filter[user.username]={}&filter[date_updated.gt]={}".format(
                self.user1.username, tag1.date_updated
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
