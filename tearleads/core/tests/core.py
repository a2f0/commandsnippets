from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from tearleads.users.tests.factories import UserFactory


class BaseTestCase(APITestCase):
    
    @classmethod
    def setUpTestData(cls):
        cls.user1 = UserFactory(username='user1', email='user1@tearleads.com')
        cls.user1_token = Token.objects.get_or_create(user=cls.user1)
        cls.user1_api_client = APIClient()
        cls.user1_api_client.credentials(HTTP_AUTHORIZATION='Token ' + str(cls.user1_token[0]))
    def setUp(self):
        pass
