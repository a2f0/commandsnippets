from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.tests.factories import (TagFactory,
                                            TagTextEntryThroughModelFactory)

from .factories import TextEntryFactory


class TestTextEntriesApi(BaseTestCase):

    def setUp(self):
        super(TestTextEntriesApi, self).setUp()
    
    @classmethod
    def setUpTestData(cls):
        super(TestTextEntriesApi, cls).setUpTestData()
    
    def test_serialization_format(self):
        entry = TextEntryFactory(user=self.user1)
        response = self.user1_api_client.get('/api/v1/entries')
        json_response = response.json()
        self.assertEqual(len(json_response['data']), 1)
        self.assertEqual(json_response['data'][0]['id'],str(entry.id))
        self.assertEqual(json_response['data'][0]['attributes']['subject'],entry.subject)
        self.assertEqual(json_response['data'][0]['attributes']['body'],entry.body)
        self.assertEqual(json_response['data'][0]['attributes']['date_created'], str(entry.date_created.isoformat()))
        self.assertEqual(json_response['data'][0]['attributes']['date_updated'], str(entry.date_updated.isoformat()))
        self.assertEqual(len(json_response['included']), 1)
        self.assertEqual(json_response['included'][0]['type'],'User')
        self.assertEqual(len(json_response['included'][0]['attributes']),1)
        self.assertEqual(json_response['included'][0]['attributes']['username'],'user1')
    
    def test_bad_filter(self):
        # invalid filter
        response = self.user1_api_client.get('/api/v1/entries?filter[bad]=1')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'invalid filter[bad]')

        # filter by single id
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user1)
        response = self.user1_api_client.get('/api/v1/entries?filter[id]={}'.format(entry1.id))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))
        response = self.user1_api_client.get('/api/v1/entries?filter[id]={}'.format(entry2.id))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response['data'][0]['id'],str(entry2.id))

        # filter by tag name
        entry1 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1, name='zzz')
        TagTextEntryThroughModelFactory(text_entry=entry1, tag=tag1)
        response = self.user1_api_client.get('/api/v1/entries?filter[tags.name]={}'.format('zzz'))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 1)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))
        # make sure a tag of yyy returns no results
        response = self.user1_api_client.get('/api/v1/entries?filter[tags.name]={}'.format('yyy'))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 0)
