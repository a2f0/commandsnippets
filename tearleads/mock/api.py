from rest_framework import filters, viewsets, response, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response


class MockGoogleOAuthAccessToken(APIView):
    def post(self, request, *args, **kwargs):
        response = Response({"access_token": "valid_access_token"})
        return response


class MockGoogleOAuthUserInfo(APIView):
    def post(self, request, *args, **kwargs):
        response = Response({"valid_email": "valid@gmail.com"})
        return response
