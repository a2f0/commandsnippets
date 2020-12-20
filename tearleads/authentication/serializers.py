from rest_framework_json_api import serializers

from tearleads.users.models import User


class GithubAuthenticationSerializer(serializers.Serializer):
    code = serializers.CharField()
