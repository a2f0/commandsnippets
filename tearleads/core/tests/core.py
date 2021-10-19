from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from http import cookies

from tearleads.users.tests.factories import UserFactory


class BaseTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user1 = UserFactory()
        cls.user2 = UserFactory()
        cls.user1_api_client = APIClient()

        token1 = Token.objects.get(user__username=cls.user1.username)
        C1 = cookies.SimpleCookie()
        C1["Authorization"] = token1.key
        cls.user1_api_client.cookies = C1

        cls.unauthenticated_user = UserFactory()
        cls.unauthenticated_user_api_client = APIClient()

    def setUp(self):
        pass
