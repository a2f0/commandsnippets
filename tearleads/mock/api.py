from rest_framework import filters, viewsets, response, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response


class MockGoogleOAuthAccessToken(APIView):

    renderer_classes = [JSONRenderer]

    def post(self, request, *args, **kwargs):
        response = Response(
            {"access_token": "valid_access_token"}, status=status.HTTP_200_OK
        )
        return response


class MockGoogleOAuthUserInfo(APIView):

    renderer_classes = [JSONRenderer]

    def get(self, request, *args, **kwargs):
        response = Response({"email": "valid@gmail.com"}, status=status.HTTP_200_OK)
        return response
