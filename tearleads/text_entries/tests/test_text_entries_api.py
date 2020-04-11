from rest_framework.test import APIRequestFactory, APIClient
from rest_framework import status

from tearleads.core.tests.core import BaseTestCase

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
        entry = TextEntryFactory(user=self.user1)
        # invalid filter
        response = self.user1_api_client.get('/api/v1/entries?filter[bad]=1')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'invalid filter[bad]')