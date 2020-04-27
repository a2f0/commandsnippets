from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from tearleads.users.tests.factories import UserFactory


class BaseTestCase(APITestCase):
    
    @classmethod
    def setUpTestData(cls):
        cls.user1 = UserFactory()
        cls.user1_api_client = APIClient()
        token = Token.objects.get(user__username=cls.user1.username)
        cls.user1_api_client = APIClient()
        cls.user1_api_client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
    def setUp(self):
        pass
