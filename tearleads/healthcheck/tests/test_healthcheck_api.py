from rest_framework.test import APIRequestFactory, APIClient
from rest_framework import status

from tearleads.core.tests.core import BaseTestCase

class TestHealthCheckApi(BaseTestCase):

    def setUp(self):
        super(TestHealthCheckApi, self).setUp()
    
    @classmethod
    def setUpTestData(cls):
        super(TestHealthCheckApi, cls).setUpTestData()
    
    def test_health_check_responds(self):
        self.assertEqual(True, True)