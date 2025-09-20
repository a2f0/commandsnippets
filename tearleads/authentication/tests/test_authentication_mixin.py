from unittest.mock import Mock, patch

from django.test import RequestFactory, TestCase

from tearleads.authentication.api import AuthenticationMixin


class TestAuthenticationMixin(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.mixin = AuthenticationMixin()

    def _create_mock_request(self, host):
        """Create a mock request with the specified host."""
        request = Mock()
        request.get_host.return_value = host
        return request

    def test_is_local_dev_with_localhost(self):
        """Test _is_local_dev returns True for localhost."""
        request = self._create_mock_request("localhost")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_localhost_and_port(self):
        """Test _is_local_dev returns True for localhost with port."""
        request = self._create_mock_request("localhost:3000")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_127_0_0_1(self):
        """Test _is_local_dev returns True for 127.0.0.1."""
        request = self._create_mock_request("127.0.0.1")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_127_0_0_1_and_port(self):
        """Test _is_local_dev returns True for 127.0.0.1 with port."""
        request = self._create_mock_request("127.0.0.1:8000")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_private_ip_10_range(self):
        """Test _is_local_dev returns True for private IP in 10.x range."""
        request = self._create_mock_request("10.0.0.1")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_private_ip_192_range(self):
        """Test _is_local_dev returns True for private IP in 192.168.x range."""
        request = self._create_mock_request("192.168.1.1")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_private_ip_172_range(self):
        """Test _is_local_dev returns True for private IP in 172.16.x range."""
        request = self._create_mock_request("172.16.0.1")
        self.assertTrue(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_public_ip(self):
        """Test _is_local_dev returns False for public IP."""
        request = self._create_mock_request("8.8.8.8")
        self.assertFalse(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_domain_name(self):
        """Test _is_local_dev returns False for domain names."""
        request = self._create_mock_request("example.com")
        self.assertFalse(self.mixin._is_local_dev(request))

    def test_is_local_dev_with_domain_name_and_port(self):
        """Test _is_local_dev returns False for domain names with port."""
        request = self._create_mock_request("example.com:443")
        self.assertFalse(self.mixin._is_local_dev(request))
