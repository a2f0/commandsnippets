from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APIRequestFactory

from tearleads.core.tests.core import BaseTestCase
from tearleads.users.tests.factories import UserFactory


class TestAuthentication(BaseTestCase):

    def setUp(self):
        super(TestAuthentication, self).setUp()
    
    @classmethod
    def setUpTestData(cls):
        super(TestAuthentication, cls).setUpTestData()
    
    def test_successful_authentication_then_deauthentication(self):
        self.auth_user = UserFactory()
        self.auth_user_api_client = APIClient()
        payload = {
            'username': self.auth_user.username,
            'password': 'password'
        }
        response = self.auth_user_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.cookies['Authorization'].value, Token.objects.filter(user=self.auth_user)[0].key)
        self.assertEqual('Authorization' in self.auth_user_api_client.cookies, True)
        self.assertEqual(self.auth_user_api_client.cookies['Authorization'].value, Token.objects.filter(user=self.auth_user)[0].key)
        response = self.auth_user_api_client.post('/api-token-deauth/', format='json')
        self.assertEqual('Authorization' in self.auth_user_api_client.cookies, True)
        self.assertEqual(self.auth_user_api_client.cookies['Authorization'].value, '')


    def test_failed_authentication(self):
        payload = {
            'username': 'user1',
            'password': 'wrongpassword'
        }
        response = self.user1_api_client.post('/api-token-auth/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
