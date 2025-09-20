"""
Shared utility for private network definitions.
Provides consistent private network patterns for both CORS and ALLOWED_HOSTS.
"""

import re


class PrivateNetworkHelper:
    """Helper class for defining and working with private network patterns."""

    # Private network IP ranges (RFC 1918)
    # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16

    @classmethod
    def get_regex_patterns(cls):
        """Get regex patterns for private IPs (for CORS)."""
        return [
            r"^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$",
            r"^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$",
            r"^192\.168\.\d{1,3}\.\d{1,3}$",
        ]

    @classmethod
    def get_allowed_hosts_patterns(cls):
        """Get wildcard patterns for private IPs (for ALLOWED_HOSTS)."""
        return [
            "10.*",
            "172.16.*",
            "172.17.*",
            "172.18.*",
            "172.19.*",
            "172.2*",
            "172.3*",
            "192.168.*",
        ]

    @classmethod
    def is_private_ip(cls, ip_str):
        """Check if an IP string matches private network patterns."""
        patterns = cls.get_regex_patterns()
        for pattern in patterns:
            if re.match(pattern, ip_str):
                return True
        return False
