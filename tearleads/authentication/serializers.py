from rest_framework_json_api import serializers

from tearleads.users.models import User


class GithubAuthenticationSerializer(serializers.Serializer):
    code = serializers.CharField()


class GoogleAuthenticationSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="Google authorization code or access token")


class IntegratedOAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(
        choices=["google", "github", "facebook"], help_text="OAuth provider"
    )
    code = serializers.CharField(help_text="Authorization code or access token")
