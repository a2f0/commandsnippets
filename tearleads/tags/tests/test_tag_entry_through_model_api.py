from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TagFactory, TagTextEntryThroughModelFactory

import pprint

class TestTagsEntriesApi(BaseTestCase):

    def setUp(self):
        super(TestTagsEntriesApi, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsEntriesApi, cls).setUpTestData()

    def test_serialization_format(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(tag=tag, text_entry=text_entry, user=self.user1)
        response = self.user1_api_client.get('/api/v1/tags_entries/' + str(tag_text_entry.id))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(json_response['data']['id'],str(tag_text_entry.id))
        self.assertEqual(json_response['data']['type'],'TagTextEntryThroughModel')
        self.assertEqual(json_response['data']['relationships']['tag']['data']['id'], str(tag.id))
        self.assertEqual(json_response['data']['relationships']['tag']['data']['type'], 'Tag')
        self.assertEqual(json_response['data']['relationships']['user']['data']['id'], str(self.user1.id))
        self.assertEqual(json_response['data']['relationships']['user']['data']['type'], 'User')
        self.assertEqual(len(json_response['included']), 2)
        self.assertEqual(json_response['included'][0]['type'],'Tag')
        self.assertEqual(len(json_response['included'][0]['attributes']),3)
        self.assertEqual(json_response['included'][0]['attributes']['name'],tag.name)
        self.assertEqual(json_response['included'][0]['attributes']['date_updated'], str(tag.date_updated.isoformat()))
        self.assertEqual(json_response['included'][0]['attributes']['date_created'], str(tag.date_created.isoformat()))
        self.assertEqual(json_response['included'][1]['type'],'User')
        self.assertEqual(len(json_response['included'][1]['attributes']),1)
        self.assertEqual(json_response['included'][1]['attributes']['username'],self.user1.username)
    
    def test_can_tag_self_owned(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        payload = {
            'password': 'password'
        }
        payload = {
            'data': {
                'type': 'TagTextEntryThroughModel',
                'attributes': {},
                'relationships': {
                    'tag': {
                        'data': {
                            'type': 'Tag', 
                            'id': tag.id 
                        }
                    },
                    'text_entry': {
                        'data': {
                            'type': 'TextEntry',
                            'id': text_entry.id
                        }
                    }
                }
            }
        }
        response = self.user1_api_client.post('/api/v1/tags_entries', payload, format='vnd.api+json')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
