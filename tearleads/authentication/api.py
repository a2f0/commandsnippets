import json
import os
from urllib.parse import parse_qs

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility
from tearleads.users.models import User
from tearleads.users.utils import create_collisionless_user

from .serializers import (
    GithubAuthenticationSerializer,
    GoogleAuthenticationSerializer,
    IntegratedOAuthSerializer,
)
from .services import GithubOAuthService, GoogleOAuthService


class AuthenticationMixin:
    """Shared authentication helper methods."""

    def _is_local_dev(self, request):
        """Determine if we're in a local/Docker development environment."""
        return settings.DEBUG or getattr(settings, "IS_LOCAL_DEV", False)

    def _create_error_response(
        self, error_message, status_code=status.HTTP_401_UNAUTHORIZED
    ):
        """Create standardized error response."""
        return Response({"error": error_message}, status=status_code)

    def _create_auth_response(self, user, request):
        """Create authenticated response with proper cookies."""
        token, created = Token.objects.get_or_create(user=user)
        response = Response({})

        is_local_dev = self._is_local_dev(request)
        cookie_domain = None if is_local_dev else settings.COOKIE_DOMAIN

        response.set_cookie(
            "Authorization",
            token.key,
            httponly=True,
            secure=not is_local_dev,  # Use HTTPS in production only
            samesite="lax" if is_local_dev else "strict",
            domain=cookie_domain,
            max_age=2419200,
        )
        response.set_cookie(
            "LoggedIn",
            None,
            httponly=False,
            max_age=2419200,
            samesite="lax" if is_local_dev else "strict",
            domain=cookie_domain,
        )
        return response

    def _process_user_login(self, user):
        """Update user login information."""
        user.last_login = timezone.now()
        user.login_count += 1
        user.save(update_fields=["last_login", "login_count"])

    def _process_oauth_user(self, email, username=None):
        """Process OAuth user data and handle user creation/update."""
        if username is None:
            username = email.split("@", 1)[0]
        user, created = create_collisionless_user(username, email)
        if not created:
            self._process_user_login(user)
        return user


class CustomObtainAuthToken(ObtainAuthToken, AuthenticationMixin):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return self._create_auth_response(user, request)


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
                            user, created = create_collisionless_user(
                                username, email["email"]
                            )
                            if created == False:
                                # Then it is a login for an existing user
                                user.last_login = timezone.now()
                                user.login_count += 1
                                user.save(update_fields=["last_login", "login_count"])
                            token, created = Token.objects.get_or_create(user=user)

                            is_local_dev = (
                                settings.COOKIE_DOMAIN == "localhost"
                                or settings.COOKIE_DOMAIN == "127.0.0.1"
                            )
                            cookie_domain = (
                                None if is_local_dev else settings.COOKIE_DOMAIN
                            )

                            response = Response({})
                            response.set_cookie(
                                "Authorization",
                                token.key,
                                httponly=True,
                                secure=not is_local_dev,
                                samesite="lax" if is_local_dev else "strict",
                                domain=cookie_domain,
                                max_age=2419200,
                            )
                            response.set_cookie(
                                "LoggedIn",
                                None,
                                httponly=False,
                                max_age=2419200,
                                samesite="lax" if is_local_dev else "strict",
                                domain=cookie_domain,
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
                email = response_dict.get("email")
                if not email:
                    return Response(
                        {"error": "No email found in Google user data"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                username = email.split("@", 1)[0]
                user, created = create_collisionless_user(username, email)
                if created == False:
                    # Then it is a login for an existing user
                    user.last_login = timezone.now()
                    user.login_count += 1
                    user.save(update_fields=["last_login", "login_count"])
                token, created = Token.objects.get_or_create(user=user)

                is_local_dev = (
                    settings.COOKIE_DOMAIN == "localhost"
                    or settings.COOKIE_DOMAIN == "127.0.0.1"
                )
                cookie_domain = None if is_local_dev else settings.COOKIE_DOMAIN

                response = Response({})
                response.set_cookie(
                    "Authorization",
                    token.key,
                    httponly=True,
                    secure=not is_local_dev,
                    samesite="lax" if is_local_dev else "strict",
                    domain=cookie_domain,
                    max_age=2419200,
                )
                response.set_cookie(
                    "LoggedIn",
                    None,
                    httponly=False,
                    max_age=2419200,
                    samesite="lax" if is_local_dev else "strict",
                    domain=cookie_domain,
                )
                return response
            else:
                return Response(
                    {"error": "A communication error has occurred."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            return Response(
                {"error": "Invalid authorization code."},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class IntegratedOAuthLogin(APIView, AuthenticationMixin):
    """Integrated OAuth endpoint supporting multiple providers."""

    resource_name = "IntegratedOAuthLogin"

    def _handle_google_oauth(self, code_or_token, request):
        """Handle Google OAuth flow."""
        service = GoogleOAuthService(request=request)

        # First, try using it as an access token (iOS native auth case)
        user_response = service.user(code_or_token)

        if user_response.status_code == 200:
            # It's a valid access token
            access_token = code_or_token
        else:
            # Not a valid token, try exchanging it as an authorization code
            token_response = service.access_token(code_or_token)
            if token_response.status_code != 200:
                return None, "Invalid authorization code or access token provided"
            response_dict = json.loads(token_response.text)
            access_token = response_dict["access_token"]

            # Fetch user info with the newly obtained access token
            user_response = service.user(access_token)
            if user_response.status_code != 200:
                return None, "Failed to fetch user information from Google"

        user_data = json.loads(user_response.text)
        email = user_data.get("email")
        if not email:
            return None, "No email found in Google user data"

        user = self._process_oauth_user(email)
        return user, None

    def _handle_github_oauth(self, code):
        """Handle GitHub OAuth flow."""
        service = GithubOAuthService()
        response = service.access_token(code)

        if response.status_code != 200:
            return None, "Invalid GitHub authorization code"

        qs = parse_qs(response.text)
        access_token = qs.get("access_token")
        if not access_token:
            return None, "No access token received from GitHub"

        access_token = access_token[0]

        # Get the GitHub login
        response = service.user(access_token)
        if response.status_code != 200:
            return None, "Failed to fetch user information from GitHub"

        data = json.loads(response.text)
        username = data.get("login")
        if not username:
            return None, "No username found in GitHub user data"

        # Get the primary email
        response = service.emails(access_token)
        if response.status_code != 200:
            return None, "Failed to fetch email information from GitHub"

        data = json.loads(response.text)
        primary_email = None
        for email in data:
            if email.get("primary"):
                primary_email = email["email"]
                break

        if not primary_email:
            return None, "No primary email found in GitHub user data"

        user = self._process_oauth_user(primary_email, username=username)
        return user, None

    def post(self, request, *args, **kwargs):
        serializer = IntegratedOAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        provider = serializer.validated_data["provider"]
        code = serializer.validated_data["code"]

        if provider == "google":
            user, error = self._handle_google_oauth(code, request)
        elif provider == "github":
            user, error = self._handle_github_oauth(code)
        else:
            raise ValidationError(
                detail=f"Unsupported provider: {provider}", code="unsupported_provider"
            )

        if error:
            raise AuthenticationFailed(detail=error)

        return self._create_auth_response(user, request)
