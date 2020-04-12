from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase


class TestAuthentication(BaseTestCase):

    def setUp(self):
        super(TestAuthentication, self).setUp()
    
    @classmethod
    def setUpTestData(cls):
        super(TestAuthentication, cls).setUpTestData()
    
    def test_successful_authentication(self):
        payload = {
            'username': 'user1',
            'password': 'password'
        }
        response = self.user1_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['token'], Token.objects.filter(user=self.user1)[0].key)

    def test_failed_authentication(self):
        payload = {
            'username': 'user1',
            'password': 'wrongpassword'
        }
        response = self.user1_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
