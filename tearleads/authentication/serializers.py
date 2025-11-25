from rest_framework_json_api import serializers


class GithubAuthenticationSerializer(serializers.Serializer):
    code = serializers.CharField()
    clientType = serializers.ChoiceField(
        choices=["web", "electron"], help_text="OAuth client type"
    )


class GoogleAuthenticationSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="Google authorization code or access token")


class IntegratedOAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=["google"], help_text="OAuth provider")
    token = serializers.CharField(help_text="Access token")
