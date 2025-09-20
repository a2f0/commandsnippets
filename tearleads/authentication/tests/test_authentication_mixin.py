from unittest.mock import Mock, patch

from django.test import RequestFactory, TestCase, override_settings

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

    @override_settings(DEBUG=True)
    def test_is_local_dev_with_debug_true(self):
        """Test _is_local_dev returns True when DEBUG=True."""
        request = self._create_mock_request("example.com")
        self.assertTrue(self.mixin._is_local_dev(request))

    @override_settings(DEBUG=False)
    def test_is_local_dev_with_debug_false(self):
        """Test _is_local_dev returns False when DEBUG=False and no IS_LOCAL_DEV."""
        request = self._create_mock_request("example.com")
        self.assertFalse(self.mixin._is_local_dev(request))

    @override_settings(DEBUG=False, IS_LOCAL_DEV=True)
    def test_is_local_dev_with_explicit_setting_true(self):
        """Test _is_local_dev returns True when IS_LOCAL_DEV=True."""
        request = self._create_mock_request("example.com")
        self.assertTrue(self.mixin._is_local_dev(request))

    @override_settings(DEBUG=False, IS_LOCAL_DEV=False)
    def test_is_local_dev_with_explicit_setting_false(self):
        """Test _is_local_dev returns False when IS_LOCAL_DEV=False."""
        request = self._create_mock_request("example.com")
        self.assertFalse(self.mixin._is_local_dev(request))

    @override_settings(DEBUG=True, IS_LOCAL_DEV=False)
    def test_is_local_dev_debug_overrides_explicit_setting(self):
        """Test _is_local_dev returns True when DEBUG=True even if IS_LOCAL_DEV=False."""
        request = self._create_mock_request("example.com")
        self.assertTrue(self.mixin._is_local_dev(request))
