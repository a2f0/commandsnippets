from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase

from .factories import TagFactory


class TestTagsApi(BaseTestCase):

    def setUp(self):
        super(TestTagsApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsApi, cls).setUpTestData()

    def test_serialization_format(self):
        tag = TagFactory(user=self.user1)
        response = self.user1_api_client.get('/api/v1/tags')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()['data']), 1)
        self.assertEqual(response.json()['data'][0]['id'],str(tag.id))
        self.assertEqual(response.json()['data'][0]['attributes']['name'],tag.name)
        self.assertEqual(response.json()['data'][0]['attributes']['date_created'], str(tag.date_created.isoformat()))
        self.assertEqual(response.json()['data'][0]['attributes']['date_updated'], str(tag.date_updated.isoformat()))
        self.assertEqual(len(response.json()['included']), 1)
        self.assertEqual(response.json()['included'][0]['type'],'User')
        self.assertEqual(len(response.json()['included'][0]['attributes']),1)
        self.assertEqual(response.json()['included'][0]['attributes']['username'],'user1')

    def test_order_filter(self):
        tag1 = TagFactory(user=self.user1, name='a')
        tag2 = TagFactory(user=self.user1, name='z')

        # invalid sort key
        response = self.user1_api_client.get('/api/v1/tags?sort=invalid_sort_key')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # sort by name
        response = self.user1_api_client.get('/api/v1/tags?sort=name')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag1.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag2.id))

        # reverse sort by name
        response = self.user1_api_client.get('/api/v1/tags?sort=-name')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag2.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag1.id))

        # sort by date_created
        response = self.user1_api_client.get('/api/v1/tags?sort=date_created')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag1.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag2.id))

        # reverse sort by date_created
        response = self.user1_api_client.get('/api/v1/tags?sort=-date_created')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag2.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag1.id))
