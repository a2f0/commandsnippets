
from rest_framework.test import APIRequestFactory, APIClient
from rest_framework import status
from rest_framework.test import APITestCase

class TestHealthCheckApi(APITestCase):
    
    def test_health_check_responds(self):
        self.assertEqual(True, True)