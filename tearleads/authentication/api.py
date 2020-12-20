import requests
from urllib.parse import parse_qs
import json
import os

from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility
from tearleads.users.models import User

from .serializers import GithubAuthenticationSerializer


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
            login = data["login"]

            # To get the email
            response = requests.get(
                url="https://api.github.com/user/emails", headers=headers
            )
            data = json.loads(response.text)

            for email in data:
                if email["primary"] == True:
                    user, created = User.objects.get_or_create(
                        email=email["email"], defaults={"login": login}
                    )
                    token, created = Token.objects.get_or_create(user=user)
                    response = Response({})
                    response.set_cookie("Authorization", token.key, httponly=True)
                    response.set_cookie("LoggedInUser", login, httponly=False)
                    return response

        else:
            return Response({})
