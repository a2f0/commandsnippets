from django.test import TestCase

from tearleads.authentication.serializers import IntegratedOAuthSerializer


class TestIntegratedOAuthSerializer(TestCase):
    def test_valid_google_data(self):
        """Test serializer with valid Google provider data"""
        data = {"provider": "google", "code": "test_google_code"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["provider"], "google")
        self.assertEqual(serializer.validated_data["code"], "test_google_code")

    def test_valid_github_data(self):
        """Test serializer with valid GitHub provider data"""
        data = {"provider": "github", "code": "test_github_code"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["provider"], "github")
        self.assertEqual(serializer.validated_data["code"], "test_github_code")

    def test_invalid_provider(self):
        """Test serializer with invalid provider"""
        data = {"provider": "facebook", "code": "test_code"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)

    def test_missing_provider(self):
        """Test serializer with missing provider field"""
        data = {"code": "test_code"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)

    def test_missing_code(self):
        """Test serializer with missing code field"""
        data = {"provider": "google"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("code", serializer.errors)

    def test_empty_data(self):
        """Test serializer with empty data"""
        data = {}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)
        self.assertIn("code", serializer.errors)

    def test_choice_field_case_sensitivity(self):
        """Test that provider field is case sensitive"""
        data = {"provider": "Google", "code": "test_code"}  # Capital G
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)
