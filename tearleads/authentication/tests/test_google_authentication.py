from django.contrib.staticfiles.testing import LiveServerTestCase
from rest_framework.test import APIClient

from tearleads.core.tests.core import BaseTestCase

import time


class TestGoogleAuthentication(LiveServerTestCase):
    port = 8081

    def setUp(self):
        super(TestGoogleAuthentication, self).setUp()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()

    def test_successful_google_login(self):
        self.auth_user_api_client = APIClient()
        payload = {
            "data": {"type": "GoogleLogin", "attributes": {"code": "valid_code"}}
        }
        response = self.auth_user_api_client.post(
            self.live_server_url + "/api/v1/google-login/", payload
        )
        self.assertEqual("Authorization" in self.auth_user_api_client.cookies, True)
        self.assertNotEqual(
            self.auth_user_api_client.cookies["Authorization"].value, ""
        )
