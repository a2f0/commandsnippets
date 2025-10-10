from django.test import TestCase

from tearleads.authentication.serializers import IntegratedOAuthSerializer


class TestIntegratedOAuthSerializer(TestCase):
    def test_valid_google_data(self):
        """Test serializer with valid Google provider data"""
        data = {"provider": "google", "token": "test_google_token"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["provider"], "google")
        self.assertEqual(serializer.validated_data["token"], "test_google_token")

    def test_invalid_provider(self):
        """Test serializer with invalid provider"""
        data = {"provider": "github", "token": "test_token"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)

    def test_missing_provider(self):
        """Test serializer with missing provider field"""
        data = {"token": "test_token"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)

    def test_missing_token(self):
        """Test serializer with missing token field"""
        data = {"provider": "google"}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("token", serializer.errors)

    def test_empty_data(self):
        """Test serializer with empty data"""
        data = {}
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)
        self.assertIn("token", serializer.errors)

    def test_choice_field_case_sensitivity(self):
        """Test that provider field is case sensitive"""
        data = {"provider": "Google", "token": "test_token"}  # Capital G
        serializer = IntegratedOAuthSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("provider", serializer.errors)
