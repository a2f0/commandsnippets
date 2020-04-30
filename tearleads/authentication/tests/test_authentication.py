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
    
    def test_successful_cookie_authentication(self):
        payload = {
            'username': self.user1.username,
            'password': 'password'
        }
        response = self.user1_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.cookies['Authentication'].value, Token.objects.filter(user=self.user1)[0].key)

    def test_successful_token_authentication(self):
        payload = {
            'username': self.user1.username,
            'password': 'password'
        }
        response = self.user1_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


    def test_failed_authentication(self):
        payload = {
            'username': 'user1',
            'password': 'wrongpassword'
        }
        response = self.user1_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
