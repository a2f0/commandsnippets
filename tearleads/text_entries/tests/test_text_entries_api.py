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
        self.assertEqual(json_response['included'][0]['attributes']['username'],self.user1.username)
    
    def test_bad_filter(self):
        # invalid filter
        response = self.user1_api_client.get('/api/v1/entries?filter[bad]=1')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'invalid filter[bad]')
    
    def test_filter_by_id(self):
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

    def test_filter_by_tag_name(self):
        entry1 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1, name='zzz')
        TagTextEntryThroughModelFactory(text_entry=entry1, tag=tag1, user=self.user1)
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

    def test_filter_by_tag_id(self):
        entry1 = TextEntryFactory(user=self.user1)
        entry2 = TextEntryFactory(user=self.user1)
        tag1 = TagFactory(user=self.user1)
        TagTextEntryThroughModelFactory(text_entry=entry1, tag=tag1, user=self.user1)
        response = self.user1_api_client.get('/api/v1/entries?filter[tags.id]={}'.format(tag1.id))
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 1)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))

    def test_order_filter(self):
        entry1 = TextEntryFactory(user=self.user1, subject='a', body='z')
        entry2 = TextEntryFactory(user=self.user1, subject='b', body='y')

        # invalid sort key
        response = self.user1_api_client.get('/api/v1/entries?sort=invalid_sort_key')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'invalid sort parameter: invalid_sort_key')

        # sort by body
        response = self.user1_api_client.get('/api/v1/entries?sort=body')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry1.id))

        # reverse sort by body
        response = self.user1_api_client.get('/api/v1/entries?sort=-body')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry2.id))
        
        # sort by date_created
        response = self.user1_api_client.get('/api/v1/entries?sort=date_created')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry2.id))

        # reverse sort by date_created
        response = self.user1_api_client.get('/api/v1/entries?sort=-date_created')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry1.id))

        # sort by date_updated
        response = self.user1_api_client.get('/api/v1/entries?sort=date_updated')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry2.id))

        # reverse sort by date_updated
        response = self.user1_api_client.get('/api/v1/entries?sort=-date_updated')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry1.id))

        # sort by subject
        response = self.user1_api_client.get('/api/v1/entries?sort=subject')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry1.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry2.id))

        # reverse sort by subject
        response = self.user1_api_client.get('/api/v1/entries?sort=-subject')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(json_response['data']), 2)
        self.assertEqual(json_response['data'][0]['id'],str(entry2.id))
        self.assertEqual(json_response['data'][1]['id'],str(entry1.id))

    def test_create_entry_works_for_authenticated_user(self):
        payload = {
            'data': {
                'type': 'TextEntry',
                'attributes': {
                    'subject': 'subject',
                    'body': 'body',
                }
            }
        }
        response = self.user1_api_client.post('/api/v1/entries', payload, format='vnd.api+json')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(json_response['data']['attributes']['subject'],payload['data']['attributes']['subject'])
        self.assertEqual(json_response['data']['attributes']['body'],payload['data']['attributes']['body'])
        self.assertEqual(len(json_response['included']), 1)
        self.assertEqual(json_response['included'][0]['type'],'User')
        self.assertEqual(len(json_response['included'][0]['attributes']),1)
        self.assertEqual(json_response['included'][0]['attributes']['username'],self.user1.username)

    def test_create_entry_fails_for_unauthenticated_user(self):
        payload = {
            'data': {
                'type': 'TextEntry',
                'attributes': {
                    'subject': 'subject',
                    'body': 'body',
                }
            }
        }
        response = self.unauthenticated_user_api_client.post('/api/v1/entries', payload, format='vnd.api+json')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(json_response['errors']), 1)
        self.assertEqual(json_response['errors'][0]['detail'], 'Authentication credentials were not provided.')
    
    def test_edit_works_when_modifying_self_owned_object(self):
        entry1 = TextEntryFactory(user=self.user1)
        payload = {
            'data': {
                'type': 'TextEntry',
                'attributes': {
                    'subject': 'new subject',
                    'body': 'new body',
                }
            }
        }
        response = self.user1_api_client.post('/api/v1/entries', payload, format='vnd.api+json')
        json_response = response.json()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(json_response['data']['attributes']['subject'],payload['data']['attributes']['subject'])
        self.assertEqual(json_response['data']['attributes']['body'],payload['data']['attributes']['body'])
        self.assertEqual(len(json_response['included']), 1)
        self.assertEqual(json_response['included'][0]['type'],'User')
        self.assertEqual(len(json_response['included'][0]['attributes']),1)
        self.assertEqual(json_response['included'][0]['attributes']['username'],self.user1.username)