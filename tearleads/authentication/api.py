import requests
from urllib.parse import parse_qs
import json
import os

from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility
from tearleads.users.models import User

from .serializers import GithubAuthenticationSerializer, GoogleAuthenticationSerializer


class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, created = Token.objects.get_or_create(user=user)
        response = Response({})
        response.set_cookie("Authorization", token.key, httponly=True)
        return response


class CustomInvalidateAuthToken(APIView):
    def post(self, request, *args, **kwargs):
        ca = utility.CustomAuthentication()
        ca.deauthenticate(request)
        response = Response({})
        response.delete_cookie("Authorization")
        return response


class GithubLogin(APIView):
    resource_name = "GithubLogin"

    def post(self, request, *args, **kwargs):
        serializer = GithubAuthenticationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            "client_id": os.environ["GITHUB_CLIENT_ID"],
            "code": serializer.data["code"],
            "client_secret": os.environ["GITHUB_CLIENT_SECRET"],
        }
        response = requests.post(
            url="https://github.com/login/oauth/access_token", data=data
        )
        if response.status_code == 200:
            qs = parse_qs(response.text)
            payload = {"token": qs["access_token"][0]}
            authorization_header = "token " + qs["access_token"][0]
            headers = {"Authorization": authorization_header}

            # Get the Github login
            authorization_header = "token " + qs["access_token"][0]
            headers = {"Authorization": authorization_header}
            response = requests.get(url="https://api.github.com/user", headers=headers)
            data = json.loads(response.text)
            username = data["login"]

            # To get the email
            response = requests.get(
                url="https://api.github.com/user/emails", headers=headers
            )
            data = json.loads(response.text)

            for email in data:
                if email["primary"] == True:
                    user, created = User.objects.get_or_create(
                        email=email["email"], defaults={"username": username}
                    )
                    token, created = Token.objects.get_or_create(user=user)
                    response = Response({})
                    response.set_cookie("Authorization", token.key, httponly=True)
                    return response

        else:
            return Response({}, status=status.HTTP_401_UNAUTHORIZED)


class GoogleLogin(APIView):
    resource_name = "GoogleLogin"

    def post(self, request, *args, **kwargs):
        serializer = GoogleAuthenticationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "code": serializer.data["code"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": os.environ["GOOGLE_REDIRECT_URI"],
            "grant_type": "authorization_code",
        }
        response = requests.post(url="https://oauth2.googleapis.com/token", data=data)
        if response.status_code == 200:
            response_dict = json.loads(response.text)
            authorization_header = "Bearer " + response_dict["access_token"]
            headers = {"Authorization": authorization_header}

            # Get the email address associated with the account
            response = requests.get(
                url="https://www.googleapis.com/oauth2/v3/userinfo?access_token="
                + response_dict["access_token"]
            )
            response_dict = json.loads(response.text)
            email = response_dict["email"]
            username = email.split("@", 1)[0]
            user, created = User.objects.get_or_create(
                email=email, defaults={"username": username}
            )
            token, created = Token.objects.get_or_create(user=user)
            response = Response({})
            response.set_cookie("Authorization", token.key, httponly=True)
            return response
        else:
            return Response({}, status=status.HTTP_401_UNAUTHORIZED)
