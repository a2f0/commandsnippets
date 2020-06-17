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
        self.assertEqual(len(json_response['included']), 3)
        self.assertEqual(json_response['included'][0]['type'],'Tag')
        self.assertEqual(len(json_response['included'][0]['attributes']),3)
        self.assertEqual(json_response['included'][0]['attributes']['name'],tag.name)
        self.assertEqual(json_response['included'][0]['attributes']['date_updated'], str(tag.date_updated.isoformat()))
        self.assertEqual(json_response['included'][0]['attributes']['date_created'], str(tag.date_created.isoformat()))
        self.assertEqual(json_response['included'][1]['type'],'TextEntry')
        self.assertEqual(len(json_response['included'][1]['attributes']),4)
        self.assertEqual(json_response['included'][1]['attributes']['body'], str(text_entry.body))
        self.assertEqual(json_response['included'][1]['attributes']['subject'], str(text_entry.subject))
        self.assertEqual(json_response['included'][1]['attributes']['date_updated'], str(text_entry.date_updated.isoformat()))
        self.assertEqual(json_response['included'][1]['attributes']['date_created'], str(text_entry.date_created.isoformat()))
        self.assertEqual(json_response['included'][2]['type'],'User')
        self.assertEqual(len(json_response['included'][2]['attributes']),1)
        self.assertEqual(json_response['included'][2]['attributes']['username'],self.user1.username)
    
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

    def test_bad_filter(self):
        response = self.user1_api_client.get('/api/v1/tags_entries?filter[bad]=1')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'invalid filter[bad]')

    def test_filter_by_tag_name(self):
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1)
        TagTextEntryThroughModelFactory(text_entry=entry1, tag=tag1, user=self.user1)
        response = self.user1_api_client.get('/api/v1/tags_entries?filter[tag.name]={}'.format(tag1.name))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 1)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))

    def test_order_filter(self):
        tag1 = TagFactory(user=self.user1)
        tag2 = TagFactory(user=self.user1)
        text_entry1 = TextEntryFactory(user=self.user1, subject='a', body='a')
        text_entry2 = TextEntryFactory(user=self.user1, subject='z', body='z')
        tag_text_entry1 = TagTextEntryThroughModelFactory(tag=tag1, order=0, text_entry=text_entry1, user=self.user1)
        tag_text_entry2 = TagTextEntryThroughModelFactory(tag=tag2, order=1, text_entry=text_entry2, user=self.user1)

        # invalid sort key
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=invalid_sort_key')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'invalid sort parameter: invalid_sort_key')

        # sort by date created
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=date_created')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry2.id))

        # sort by date created (reversed)
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=-date_created')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry1.id))

        # sort by order
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=order')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry2.id))

        # sort by order (reversed)
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=-order')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry1.id))

        # sort by subject
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=text_entry__subject')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry2.id))

        # sort by subject (reversed)
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=-text_entry__subject')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry1.id))

        # sort by body
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=text_entry__body')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry2.id))

        # sort by body (reversed)
        response = self.user1_api_client.get('/api/v1/tags_entries?sort=-text_entry__body')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(tag_text_entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(tag_text_entry1.id))