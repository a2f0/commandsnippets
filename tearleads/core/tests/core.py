from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from tearleads.users.tests.factories import UserFactory

class BaseTestCase(APITestCase):
    
    @classmethod
    def setUpTestData(cls):
        cls.user1 = UserFactory()
    def setUp(self):
        pass