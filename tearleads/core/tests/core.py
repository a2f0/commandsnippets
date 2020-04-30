from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from http import cookies

from tearleads.users.tests.factories import UserFactory

class BaseTestCase(APITestCase):
    
    @classmethod
    def setUpTestData(cls):
        cls.user1 = UserFactory()
        cls.user1_api_client = APIClient()
        token = Token.objects.get(user__username=cls.user1.username)
        C = cookies.SimpleCookie()
        C['Authorization'] = token.key
        cls.user1_api_client.cookies = C

    def setUp(self):
        pass
