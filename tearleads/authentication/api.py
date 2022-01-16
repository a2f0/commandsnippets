import json
import os
from urllib.parse import parse_qs

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility
from tearleads.users.models import User
from tearleads.users.utils import create_collisionless_user

from .serializers import GithubAuthenticationSerializer, GoogleAuthenticationSerializer
from .services import GithubOAuthService, GoogleOAuthService


class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, created = Token.objects.get_or_create(user=user)
        response = Response({})
        response.set_cookie(
            "Authorization",
            token.key,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=2419200,
        )
        response.set_cookie("LoggedIn", None, httponly=False)
        return response


class CustomInvalidateAuthToken(APIView):
    def post(self, request, *args, **kwargs):
        ca = utility.CustomAuthentication()
        ca.deauthenticate(request)
        response = Response({})
        response.delete_cookie("Authorization")
        response.delete_cookie("LoggedIn")
        return response


class GithubLogin(APIView):
    resource_name = "GithubLogin"

    def post(self, request, *args, **kwargs):
        serializer = GithubAuthenticationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = GithubOAuthService()
        response = service.access_token(serializer.data["code"])
        if response.status_code == 200:
            qs = parse_qs(response.text)
            access_token = qs["access_token"][0]
            # Get the Github login
            response = service.user(access_token)

            if response.status_code == 200:
                data = json.loads(response.text)
                username = data["login"]

                # To get the primary email
                response = service.emails(access_token)
                if response.status_code == 200:
                    data = json.loads(response.text)

                    for email in data:
                        if email["primary"] == True:
                            user = create_collisionless_user(username, email["email"])
                            token, created = Token.objects.get_or_create(user=user)
                            response = Response({})
                            response.set_cookie(
                                "Authorization",
                                token.key,
                                httponly=True,
                                secure=True,
                                samesite="strict",
                                max_age=2419200,
                            )
                            response.set_cookie(
                                "LoggedIn", None, httponly=False, max_age=2419200
                            )
                            return response

        return Response({}, status=status.HTTP_401_UNAUTHORIZED)


class GoogleLogin(APIView):
    resource_name = "GoogleLogin"

    def post(self, request, *args, **kwargs):
        serializer = GoogleAuthenticationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = GoogleOAuthService()
        response = service.access_token(serializer.data["code"])
        if response.status_code == 200:
            response_dict = json.loads(response.text)
            authorization_header = "Bearer " + response_dict["access_token"]
            headers = {"Authorization": authorization_header}

            # Get the email address associated with the account
            response = service.user(response_dict["access_token"])
            if response.status_code == 200:
                response_dict = json.loads(response.text)
                email = response_dict["email"]
                username = email.split("@", 1)[0]
                user = create_collisionless_user(username, email)
                token, created = Token.objects.get_or_create(user=user)
                response = Response({})
                response.set_cookie(
                    "Authorization",
                    token.key,
                    httponly=True,
                    secure=True,
                    samesite="strict",
                    max_age=2419200,
                )
                response.set_cookie("LoggedIn", None, httponly=False, max_age=2419200)
                return response

        return Response({}, status=status.HTTP_401_UNAUTHORIZED)
