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
        response = self.user1_api_client.get('/api/v1/entries/')
        self.assertEqual(len(response.json()['data']), 1)
        self.assertEqual(response.json()['data'][0]['id'],str(entry.id))
        self.assertEqual(response.json()['data'][0]['attributes']['subject'],entry.subject)
        self.assertEqual(response.json()['data'][0]['attributes']['body'],entry.body)
        self.assertEqual(response.json()['data'][0]['attributes']['date_created'], str(entry.date_created.isoformat()))
        self.assertEqual(response.json()['data'][0]['attributes']['date_updated'], str(entry.date_updated.isoformat()))
        self.assertEqual(len(response.json()['included']), 1)
        self.assertEqual(response.json()['included'][0]['type'],'User')
        self.assertEqual(len(response.json()['included'][0]['attributes']),1)
        self.assertEqual(response.json()['included'][0]['attributes']['username'],'user1')