from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.tests.factories import TagFactory, TagTextEntryThroughModelFactory
from tearleads.text_entries.models import TextEntry

from .factories import TextEntryFactory


class TestTextEntriesApi(BaseTestCase):
    def setUp(self):
        super(TestTextEntriesApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTextEntriesApi, cls).setUpTestData()

    def test_serialization_format(self):
        """Test the complete serialization format including main entry and all included objects."""
        entry1 = self.user1.text_entries.all().first()
        tag1 = self.user1.tags.all().first()
        tags_entries1 = entry1.text_entry_to_tag.all()[0]
        self.assertEqual(entry1.text_entry_to_tag.all().count(), 1)

        response = self.user1_api_client.get(
            "/api/v1/entries/{}?include=text_entry_to_tag.tag,text_entry_to_tag.user,user".format(
                entry1.id
            )
        )
        json_response = response.json()

        # Test main entry data
        data = json_response["data"]
        self.assertEqual(len(data), 4)
        self.assertEqual(data["id"], str(entry1.id))

        attributes = data["attributes"]
        self.assertEqual(len(attributes), 7)
        self.assertEqual(attributes["subject"], entry1.subject)
        self.assertEqual(attributes["body"], entry1.body)
        self.assertEqual(
            attributes["date_created"], str(entry1.date_created.isoformat())
        )
        self.assertEqual(
            attributes["date_updated"], str(entry1.date_updated.isoformat())
        )
        self.assertEqual(attributes["reused_count"], entry1.reused_count)
        self.assertEqual(attributes["is_deleted"], entry1.is_deleted)
        self.assertEqual(attributes["tag_count"], entry1.tag_count)

        # Test included objects
        included = json_response["included"]
        self.assertEqual(len(included), 3)

        # Test Tag (first included item)
        tag_data = included[0]
        self.assertEqual(tag_data["type"], "Tag")
        self.assertEqual(len(tag_data["attributes"]), 7)
        self.assertEqual(tag_data["attributes"]["name"], tag1.name)
        self.assertEqual(
            tag_data["attributes"]["date_created"], tag1.date_created.isoformat()
        )
        self.assertEqual(
            tag_data["attributes"]["date_last_used"], tag1.date_last_used.isoformat()
        )
        self.assertEqual(
            tag_data["attributes"]["date_updated"], tag1.date_updated.isoformat()
        )
        self.assertEqual(tag_data["attributes"]["entry_count"], tag1.entry_count)
        self.assertEqual(tag_data["attributes"]["order"], tag1.order)
        self.assertEqual(tag_data["attributes"]["is_deleted"], tag1.is_deleted)

        # Test Junction (second included item)
        junction_data = included[1]
        self.assertEqual(junction_data["type"], "TagTextEntryThroughModel")
        self.assertEqual(junction_data["id"], str(tags_entries1.id))
        self.assertEqual(len(junction_data["attributes"]), 3)
        self.assertEqual(junction_data["attributes"]["order"], tags_entries1.order)
        self.assertEqual(
            junction_data["attributes"]["date_updated"],
            tags_entries1.date_updated.isoformat(),
        )
        self.assertEqual(
            junction_data["attributes"]["date_created"],
            tags_entries1.date_created.isoformat(),
        )

        # Test User (third included item)
        user_data = included[2]
        self.assertEqual(user_data["type"], "User")
        self.assertEqual(user_data["id"], str(entry1.user.id))
        self.assertEqual(len(user_data["attributes"]), 2)
        self.assertEqual(user_data["attributes"]["username"], entry1.user.username)
        self.assertEqual(
            user_data["attributes"]["date_updated"],
            str(entry1.user.date_updated.isoformat()),
        )

    def test_pagination(self):
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()

        self.assertEqual(self.user1.text_entries.count(), 2)

        response = self.user1_api_client.get(
            "/api/v1/entries?page[number]=1&page[size]=1&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        self.assertEqual(json_response["meta"]["pagination"]["count"], 2)

        response = self.user1_api_client.get(
            "/api/v1/entries?page[number]=2&page[size]=1&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))
        self.assertEqual(json_response["meta"]["pagination"]["count"], 2)

    def test_no_filter(self):
        response = self.user1_api_client.get("/api/v1/entries")
        json_response = response.json()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(len(json_response["data"][0]), 0)

    def test_bad_filter(self):
        # invalid filter
        response = self.user1_api_client.get("/api/v1/entries?filter[bad]=1")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(json_response["errors"][0]["detail"], "invalid filter[bad]")

    def test_filter_by_id(self):
        # filter by single id
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user1)
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[id]={}".format(entry1.id)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[id]={}".format(entry2.id)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))

    def test_filter_by_tag_name(self):
        entry1 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1, name="zzz")
        TagTextEntryThroughModelFactory(text_entry=entry1, tag=tag1, user=self.user1)
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[tags.name]={}".format("zzz")
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        # make sure a tag of yyy returns no results
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[tags.name]={}".format("yyy")
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 0)

    def test_filter_by_tag_id(self):
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1)
        TagTextEntryThroughModelFactory(text_entry=entry1, tag=tag1, user=self.user1)
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[tags.id]={}".format(tag1.id)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))

    def test_filter_by_tag_count(self):
        entry1 = self.user1.text_entries.all().last()
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[tag_count]={}&filter[user.username]={}".format(
                2, self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))

    def test_filter_by_is_deleted(self):
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[is_deleted]={}&filter[user.username]={}".format(
                0, self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[is_deleted]={}&filter[user.username]={}".format(
                1, self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 0)

    def test_filter_by_username(self):
        """Test filtering text entries by username."""
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()

        # Test filtering by valid username
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = json_response["data"]
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["id"], str(entry1.id))

        # Test filtering by invalid username
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[user.username]=random"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 0)

    def test_filter_by_date_updated_gt(self):
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[date_updated.gt]={}&filter[user.username]={}".format(
                entry1.date_updated, self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))

    def test_order_filter(self):
        """Test various sorting options for text entries."""
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()

        # Test invalid sort key
        response = self.user1_api_client.get("/api/v1/entries?sort=invalid_sort_key")
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
            ("body", entry2.id, entry1.id),
            ("-body", entry1.id, entry2.id),
            ("date_created", entry1.id, entry2.id),
            ("-date_created", entry2.id, entry1.id),
            ("date_updated", entry1.id, entry2.id),
            ("-date_updated", entry2.id, entry1.id),
            ("subject", entry1.id, entry2.id),
            ("-subject", entry2.id, entry1.id),
        ]

        for sort_param, expected_first_id, expected_second_id in sort_tests:
            response = self.user1_api_client.get(
                "/api/v1/entries?sort={}&filter[user.username]={}".format(
                    sort_param, self.user1.username
                )
            )
            json_response = response.json()
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(json_response["data"]), 2)
            self.assertEqual(json_response["data"][0]["id"], str(expected_first_id))
            self.assertEqual(json_response["data"][1]["id"], str(expected_second_id))

    def test_create_entry_works_for_authenticated_user(self):
        """Test that creating a text entry works for authenticated users."""
        payload = {
            "data": {
                "type": "TextEntry",
                "attributes": {
                    "subject": "subject",
                    "body": "body",
                },
            }
        }
        response = self.user1_api_client.post(
            "/api/v1/entries", payload, format="vnd.api+json"
        )
        json_response = response.json()

        # Test main response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = json_response["data"]
        self.assertEqual(
            data["attributes"]["subject"],
            payload["data"]["attributes"]["subject"],
        )
        self.assertEqual(
            data["attributes"]["body"],
            payload["data"]["attributes"]["body"],
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

    def test_body_too_large(self):
        max_length = TextEntry._meta.get_field("body").max_length
        too_large = max_length + 1
        oversized_body = "x" * too_large

        payload = {
            "data": {
                "type": "TextEntry",
                "attributes": {
                    "subject": "subject",
                    "body": oversized_body,
                },
            }
        }
        response = self.user1_api_client.post(
            "/api/v1/entries", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            f"Ensure this field has no more than {max_length} characters.",
        )

    def test_subject_too_large(self):
        max_length = TextEntry._meta.get_field("subject").max_length
        too_large = max_length + 1
        oversized_subject = "x" * too_large

        payload = {
            "data": {
                "type": "TextEntry",
                "attributes": {
                    "subject": oversized_subject,
                    "body": "body",
                },
            }
        }
        response = self.user1_api_client.post(
            "/api/v1/entries", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            f"Ensure this field has no more than {max_length} characters.",
        )

    def test_create_entry_fails_for_unauthenticated_user(self):
        payload = {
            "data": {
                "type": "TextEntry",
                "attributes": {
                    "subject": "subject",
                    "body": "body",
                },
            }
        }
        response = self.unauthenticated_user_api_client.post(
            "/api/v1/entries", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "Authentication credentials were not provided.",
        )

    def test_edit_works_when_modifying_self_owned_object(self):
        """Test that editing works when modifying a self-owned text entry."""
        entry1 = TextEntryFactory(user=self.user1)
        payload = {
            "data": {
                "type": "TextEntry",
                "id": str(entry1.id),
                "attributes": {
                    "subject": "new subject",
                    "body": "new body",
                },
            }
        }
        response = self.user1_api_client.patch(
            "/api/v1/entries/" + str(entry1.id), payload, format="vnd.api+json"
        )
        json_response = response.json()

        # Test main response
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = json_response["data"]
        self.assertEqual(
            data["attributes"]["subject"],
            payload["data"]["attributes"]["subject"],
        )
        self.assertEqual(
            data["attributes"]["body"],
            payload["data"]["attributes"]["body"],
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

    def test_delete_works_when_self_owns_object(self):
        """Test that deletion works when the user owns the text entry."""
        entry = TextEntryFactory(user=self.user1, is_deleted=False)
        self.assertEqual(entry.is_deleted, False)

        response = self.user1_api_client.delete(
            "/api/v1/entries/" + str(entry.id), format="vnd.api+json"
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
        entry1 = TextEntryFactory(user=self.user2, is_deleted=False)
        response = self.user1_api_client.delete(
            "/api/v1/entries/" + str(entry1.id), format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "You do not have permission to perform this action.",
        )

    def test_delete_fails_for_anonymous_user(self):
        entry1 = TextEntryFactory(user=self.user2, is_deleted=False)
        payload = {
            "data": {
                "type": "TextEntry",
                "id": str(entry1.id),
                "attributes": {
                    "is_deleted": "True",
                },
            }
        }
        response = self.unauthenticated_user_api_client.delete(
            "/api/v1/entries/" + str(entry1.id), format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "Authentication credentials were not provided.",
        )

    def test_search_by_body(self):
        entry1 = self.user1.text_entries.all().first()
        response = self.user1_api_client.get(
            "/api/v1/entries?{}={}&filter[user.username]={}".format(
                settings.REST_FRAMEWORK["SEARCH_PARAM"],
                "pg_terminate_backend",
                self.user1,
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))

    def test_search_by_body(self):
        entry1 = self.user1.text_entries.all().first()
        response = self.user1_api_client.get(
            "/api/v1/entries?{}={}&filter[user.username]={}".format(
                settings.REST_FRAMEWORK["SEARCH_PARAM"],
                "pg_terminate_backend",
                self.user1,
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))

    def test_search_by_subject(self):
        entry1 = self.user1.text_entries.all().first()
        response = self.user1_api_client.get(
            "/api/v1/entries?{}={}&filter[user.username]={}".format(
                settings.REST_FRAMEWORK["SEARCH_PARAM"],
                "close all postgres connections",
                self.user1,
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 1)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
