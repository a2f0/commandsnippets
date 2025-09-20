"""
Dynamic CORS configuration to handle Docker and local development IPs.
"""

import re
from urllib.parse import urlparse

from corsheaders.signals import check_request_enabled

from tearleads.core.private_networks import PrivateNetworkHelper


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

    # Check if this is a private network IP
    if PrivateNetworkHelper.is_private_ip(hostname):
        # Only allow HTTP for private IPs (development)
        if parsed.scheme == "http":
            return True

    # Don't interfere with other CORS checks
    return None


# Connect the signal handler
check_request_enabled.connect(cors_allow_private_networks)
