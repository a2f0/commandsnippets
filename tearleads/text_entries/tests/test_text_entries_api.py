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
        response = self.user1_api_client.get('/api/v1/entries/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'],entry.id)
        self.assertEqual(response.data[0]['subject'],entry.subject)
        self.assertEqual(response.data[0]['body'],entry.body)
        self.assertEqual(response.data[0]['date_created'], str(entry.date_created.isoformat()))
        self.assertEqual(response.data[0]['date_updated'], str(entry.date_updated.isoformat()))