from django.test import TestCase
from rest_framework.test import APIClient


class TestCORSPreflightProduction(TestCase):
    """Test CORS preflight requests with production settings.

    Run with:
        DJANGO_SETTINGS_MODULE=tearleads.settings.production python manage.py test \
        tearleads.core.tests.test_cors_preflight.TestCORSPreflightProduction
    """

    def setUp(self):
        self.client = APIClient()

    def test_preflight_allows_production_domain(self):
        """Test that production domain is allowed."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://tearleads.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"],
            "https://tearleads.com",
        )
        self.assertEqual(
            response["Access-Control-Allow-Credentials"],
            "true",
        )

    def test_preflight_allows_production_subdomain(self):
        """Test that production subdomains are allowed."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://app.tearleads.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"],
            "https://app.tearleads.com",
        )

    def test_preflight_allows_staging_subdomain(self):
        """Test that staging subdomains are allowed."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://app.staging.tearleads.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"],
            "https://app.staging.tearleads.com",
        )

    def test_preflight_denies_unauthorized_origin(self):
        """Test that unauthorized origins are denied."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://evil.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertNotIn("Access-Control-Allow-Origin", response)


class TestCORSPreflightStaging(TestCase):
    """Test CORS preflight requests with staging settings.

    Run with:
        DJANGO_SETTINGS_MODULE=tearleads.settings.staging python manage.py test \
        tearleads.core.tests.test_cors_preflight.TestCORSPreflightStaging
    """

    def setUp(self):
        self.client = APIClient()

    def test_preflight_allows_production_domain(self):
        """Test that production domain is allowed."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://tearleads.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"],
            "https://tearleads.com",
        )
        self.assertEqual(
            response["Access-Control-Allow-Credentials"],
            "true",
        )

    def test_preflight_allows_production_subdomain(self):
        """Test that production subdomains are allowed."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://app.tearleads.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"],
            "https://app.tearleads.com",
        )

    def test_preflight_allows_staging_subdomain(self):
        """Test that staging subdomains are allowed."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://app.staging.tearleads.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"],
            "https://app.staging.tearleads.com",
        )

    def test_preflight_denies_unauthorized_origin(self):
        """Test that unauthorized origins are denied."""
        response = self.client.options(
            "/api/v1/entries",
            HTTP_ORIGIN="https://evil.com",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )

        self.assertNotIn("Access-Control-Allow-Origin", response)
