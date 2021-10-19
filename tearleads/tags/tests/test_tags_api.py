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
        tag = self.user1.tags.all().first()

        response = self.user1_api_client.get(
            "/api/v1/tags?&filter[user.username]={}".format(self.user1.username)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(response.json()["data"][0]["id"], str(tag.id))
        self.assertEqual(len(json_response["data"][0]["attributes"]), 7)
        self.assertEqual(json_response["data"][0]["attributes"]["name"], tag.name)
        self.assertEqual(
            json_response["data"][0]["attributes"]["date_created"],
            str(tag.date_created.isoformat()),
        )
        self.assertEqual(
            json_response["data"][0]["attributes"]["date_updated"],
            str(tag.date_updated.isoformat()),
        )
        self.assertEqual(
            json_response["data"][0]["attributes"]["date_last_used"],
            str(tag.date_last_used.isoformat()),
        )
        self.assertEqual(json_response["data"][0]["attributes"]["is_deleted"], False)
        self.assertEqual(
            json_response["data"][0]["attributes"]["entry_count"],
            tag.entry_count,
        )
        self.assertEqual(json_response["data"][0]["attributes"]["order"], tag.order)
        self.assertEqual(len(json_response["included"]), 1)
        self.assertEqual(json_response["included"][0]["type"], "User")
        self.assertEqual(len(json_response["included"][0]["attributes"]), 1)
        self.assertEqual(
            json_response["included"][0]["attributes"]["username"],
            self.user1.username,
        )

    def test_pagination(self):
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()

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

    def test_can_resurrect_self_owned(self):
        deleted_tag = TagFactory(user=self.user1, name="deleted tag", is_deleted=True)
        payload = {"data": {"type": "Tag", "attributes": {"name": "deleted tag"}}}
        response = self.user1_api_client.post(
            "/api/v1/tags", payload, format="vnd.api+json"
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            json_response["data"]["attributes"]["name"],
            payload["data"]["attributes"]["name"],
        )
        self.assertEqual(
            json_response["data"]["id"],
            str(deleted_tag.id),
        )
        self.assertEqual(len(response.json()["included"]), 1)
        self.assertEqual(response.json()["included"][0]["type"], "User")
        self.assertEqual(len(response.json()["included"][0]["attributes"]), 1)
        self.assertEqual(
            response.json()["included"][0]["attributes"]["username"],
            self.user1.username,
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

    def test_bad_filter(self):
        response = self.user1_api_client.get("/api/v1/tags?filter[bad]=1")
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response["errors"]), 1)
        self.assertEqual(json_response["errors"][0]["detail"], "invalid filter[bad]")

    def test_filter_by_user_name(self):
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()
        response = self.user1_api_client.get(
            "/api/v1/tags?filter[user.username]={}".format(self.user1.username)
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))
        response = self.user1_api_client.get(
            "/api/v1/tags?filter[user.username]=random".format(self.user1.username)
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
        tag1 = self.user1.tags.all().first()
        tag2 = self.user1.tags.all().last()

        # invalid sort key
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

        # sort by date created
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=date_created&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # sort by date created (reversed)
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=-date_created&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

        # sort by date updated
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=date_updated&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # sort by date updated (reversed)
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=-date_updated&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

        # sort by order
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=order&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # sort by order (reversed)
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=-order&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

        # sort by name
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=name&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag1.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag2.id))

        # sort by name (reversed)
        response = self.user1_api_client.get(
            "/api/v1/tags?sort=-name&filter[user.username]={}".format(
                self.user1.username
            )
        )
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response["data"]), 2)
        self.assertEqual(json_response["data"][0]["id"], str(tag2.id))
        self.assertEqual(json_response["data"][1]["id"], str(tag1.id))

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
