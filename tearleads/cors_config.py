"""
Dynamic CORS configuration to handle Docker and local development IPs.
"""

import re
from urllib.parse import urlparse

from corsheaders.signals import check_request_enabled


def cors_allow_private_networks(sender, request, **kwargs):
    """
    Django signal handler for django-cors-headers to dynamically allow
    private network origins (Docker containers, local development).
    """
    origin = request.META.get("HTTP_ORIGIN")
    if not origin:
        return None

    parsed = urlparse(origin)
    hostname = parsed.hostname

    if not hostname:
        return None

    # Allow any private network IPs (Docker containers, local networks)
    # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    private_ip_patterns = [
        r"^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$",
        r"^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$",
        r"^192\.168\.\d{1,3}\.\d{1,3}$",
    ]

    for pattern in private_ip_patterns:
        if re.match(pattern, hostname):
            # Only allow HTTP for private IPs (development)
            if parsed.scheme == "http":
                return True

    # Don't interfere with other CORS checks
    return None


# Connect the signal handler
check_request_enabled.connect(cors_allow_private_networks)
