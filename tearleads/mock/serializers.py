class MockGoogleOAuth(serializers.Serializer):
    def validate(self, attrs):
        return attrs
