from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.tests.factories import TagFactory, TagTextEntryThroughModelFactory

from .factories import TextEntryFactory


class TestTextEntriesApi(BaseTestCase):
    def setUp(self):
        super(TestTextEntriesApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTextEntriesApi, cls).setUpTestData()

    def test_serialization_format(self):
        entry1 = self.user1.text_entries.all().first()
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        self.assertEqual(
            json_response["data"][0]["attributes"]["subject"], entry1.subject
        )
        self.assertEqual(json_response["data"][0]["attributes"]["body"], entry1.body)
        self.assertEqual(
            json_response["data"][0]["attributes"]["date_created"],
            str(entry1.date_created.isoformat()),
        )
        self.assertEqual(
            json_response["data"][0]["attributes"]["date_updated"],
            str(entry1.date_updated.isoformat()),
        )
        self.assertEqual(len(json_response["included"]), 1)
        self.assertEqual(json_response["included"][0]["type"], "User")
        self.assertEqual(len(json_response["included"][0]["attributes"]), 1)
        self.assertEqual(
            json_response["included"][0]["attributes"]["username"], self.user1.username
        )

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
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        response = self.user1_api_client.get(
            "/api/v1/entries?filter[user.username]=random"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 0)

    def test_order_filter(self):
        entry1 = self.user1.text_entries.all().first()
        entry2 = self.user1.text_entries.all().last()
        # invalid sort key
        response = self.user1_api_client.get("/api/v1/entries?sort=invalid_sort_key")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(
            json_response["errors"][0]["detail"],
            "invalid sort parameter: invalid_sort_key",
        )

        # sort by body
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=body&filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry1.id))

        # reverse sort by body
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=-body&filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry2.id))

        # sort by date_created
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=date_created&filter[user.username]={}".format(
                self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry2.id))

        # reverse sort by date_created
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=-date_created&filter[user.username]={}".format(
                self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry1.id))

        # sort by date_updated
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=date_updated&filter[user.username]={}".format(
                self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry2.id))

        # reverse sort by date_updated
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=-date_updated&filter[user.username]={}".format(
                self.user1
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry1.id))

        # sort by subject
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=subject&filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry1.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry2.id))

        # reverse sort by subject
        response = self.user1_api_client.get(
            "/api/v1/entries?sort=-subject&filter[user.username]={}".format(self.user1)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(entry2.id))
        self.assertEqual(json_response["data"][1]["id"], str(entry1.id))

    def test_create_entry_works_for_authenticated_user(self):
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
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            json_response["data"]["attributes"]["subject"],
            payload["data"]["attributes"]["subject"],
        )
        self.assertEqual(
            json_response["data"]["attributes"]["body"],
            payload["data"]["attributes"]["body"],
        )
        self.assertEqual(len(json_response["included"]), 1)
        self.assertEqual(json_response["included"][0]["type"], "User")
        self.assertEqual(len(json_response["included"][0]["attributes"]), 1)
        self.assertEqual(
            json_response["included"][0]["attributes"]["username"], self.user1.username
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
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            json_response["data"]["attributes"]["subject"],
            payload["data"]["attributes"]["subject"],
        )
        self.assertEqual(
            json_response["data"]["attributes"]["body"],
            payload["data"]["attributes"]["body"],
        )
        self.assertEqual(len(json_response["included"]), 1)
        self.assertEqual(json_response["included"][0]["type"], "User")
        self.assertEqual(len(json_response["included"][0]["attributes"]), 1)
        self.assertEqual(
            json_response["included"][0]["attributes"]["username"], self.user1.username
        )

    def test_delete_works_when_self_owns_object(self):
        entry1 = TextEntryFactory(user=self.user1, is_deleted=False)
        payload = {
            "data": {
                "type": "TextEntry",
                "id": str(entry1.id),
                "attributes": {
                    "is_deleted": "True",
                },
            }
        }
        self.assertEqual(entry1.is_deleted, False)
        response = self.user1_api_client.delete(
            "/api/v1/entries/" + str(entry1.id), format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response["data"]["attributes"]["is_deleted"], True)
        self.assertEqual(len(json_response["included"]), 1)
        self.assertEqual(json_response["included"][0]["type"], "User")
        self.assertEqual(len(json_response["included"][0]["attributes"]), 1)
        self.assertEqual(
            json_response["included"][0]["attributes"]["username"], self.user1.username
        )

    def test_delete_fails_when_object_owned_by_other(self):
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
