from rest_framework import filters, viewsets, response, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response


class MockGoogleOAuthAccessToken(APIView):
    def post(self, request, *args, **kwargs):
        response = Response({})
        return response
