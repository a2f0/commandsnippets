from django.test import TestCase

from tearleads.core.private_networks import PrivateNetworkHelper


class TestPrivateNetworkHelper(TestCase):
    def test_get_regex_patterns(self):
        """Test that get_regex_patterns returns expected regex patterns."""
        patterns = PrivateNetworkHelper.get_regex_patterns()

        self.assertEqual(len(patterns), 3)
        self.assertIn(r"^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$", patterns)
        self.assertIn(r"^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$", patterns)
        self.assertIn(r"^192\.168\.\d{1,3}\.\d{1,3}$", patterns)

    def test_get_allowed_hosts_patterns(self):
        """Test that get_allowed_hosts_patterns returns expected wildcard patterns."""
        patterns = PrivateNetworkHelper.get_allowed_hosts_patterns()

        self.assertEqual(len(patterns), 8)
        self.assertIn("10.*", patterns)
        self.assertIn("172.16.*", patterns)
        self.assertIn("192.168.*", patterns)

    def test_is_private_ip_with_10_range(self):
        """Test is_private_ip correctly identifies 10.x.x.x IPs."""
        self.assertTrue(PrivateNetworkHelper.is_private_ip("10.0.0.1"))
        self.assertTrue(PrivateNetworkHelper.is_private_ip("10.255.255.255"))

    def test_is_private_ip_with_172_range(self):
        """Test is_private_ip correctly identifies 172.16-31.x.x IPs."""
        self.assertTrue(PrivateNetworkHelper.is_private_ip("172.16.0.1"))
        self.assertTrue(PrivateNetworkHelper.is_private_ip("172.31.255.255"))

    def test_is_private_ip_with_192_range(self):
        """Test is_private_ip correctly identifies 192.168.x.x IPs."""
        self.assertTrue(PrivateNetworkHelper.is_private_ip("192.168.0.1"))
        self.assertTrue(PrivateNetworkHelper.is_private_ip("192.168.255.255"))

    def test_is_private_ip_with_public_ips(self):
        """Test is_private_ip correctly rejects public IPs."""
        self.assertFalse(PrivateNetworkHelper.is_private_ip("8.8.8.8"))
        self.assertFalse(PrivateNetworkHelper.is_private_ip("1.1.1.1"))
        self.assertFalse(
            PrivateNetworkHelper.is_private_ip("172.32.0.1")
        )  # Outside 172.16-31 range

    def test_is_private_ip_with_invalid_ips(self):
        """Test is_private_ip correctly rejects invalid IP formats."""
        self.assertFalse(PrivateNetworkHelper.is_private_ip("not.an.ip.address"))
        self.assertFalse(PrivateNetworkHelper.is_private_ip("256.256.256.256"))
        self.assertFalse(PrivateNetworkHelper.is_private_ip(""))
        self.assertFalse(PrivateNetworkHelper.is_private_ip("localhost"))
