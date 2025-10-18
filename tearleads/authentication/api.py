import json
from urllib.parse import parse_qs

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility
from tearleads.users.utils import create_collisionless_user

from .serializers import (
    GithubAuthenticationSerializer,
    GoogleAuthenticationSerializer,
    IntegratedOAuthSerializer,
)
from .services import GithubOAuthService, GoogleOAuthService


def _create_auth_response(user):
    token, _ = Token.objects.get_or_create(user=user)
    response = Response({})

    is_local_dev = settings.DEBUG
    cookie_domain = None if is_local_dev else settings.COOKIE_DOMAIN

    response.set_cookie(
        "Authorization",
        token.key,
        httponly=True,
        secure=not is_local_dev,
        samesite="lax" if is_local_dev else "strict",
        domain=cookie_domain,
        max_age=settings.AUTH_COOKIE_MAX_AGE,
    )
    response.set_cookie(
        "LoggedIn",
        None,
        httponly=False,
        max_age=settings.AUTH_COOKIE_MAX_AGE,
        samesite="lax" if is_local_dev else "strict",
        domain=cookie_domain,
    )
    return response


class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return _create_auth_response(user)


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
                        if email["primary"] is True:
                            user, created = create_collisionless_user(
                                username, email["email"]
                            )
                            if not created:
                                # Then it is a login for an existing user
                                user.last_login = timezone.now()
                                user.login_count += 1
                                user.save(update_fields=["last_login", "login_count"])
                            return _create_auth_response(user)

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
                if not created:
                    # Then it is a login for an existing user
                    user.last_login = timezone.now()
                    user.login_count += 1
                    user.save(update_fields=["last_login", "login_count"])
                return _create_auth_response(user)

        return Response({}, status=status.HTTP_401_UNAUTHORIZED)


class IntegratedOAuthLogin(APIView):
    """Integrated OAuth endpoint supporting multiple providers."""

    resource_name = "IntegratedOAuthLogin"

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

    def _handle_google_oauth(self, token):
        """Handle Google OAuth flow with direct access token only."""
        service = GoogleOAuthService()

        # Use the provided access token directly (iOS native auth case)
        user_response = service.user(token)

        if user_response.status_code != 200:
            return None, "Invalid access token provided"

        user_data = json.loads(user_response.text)
        email = user_data.get("email")
        if not email:
            return None, "No email found in Google user data"

        user = self._process_oauth_user(email)
        return user, None

    def post(self, request, *args, **kwargs):
        serializer = IntegratedOAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        provider = serializer.validated_data["provider"]
        token = serializer.validated_data["token"]

        if provider == "google":
            user, error = self._handle_google_oauth(token)
        else:
            raise ValidationError(
                detail=f"Unsupported provider: {provider}", code="unsupported_provider"
            )

        if error:
            raise AuthenticationFailed(detail=error)

        return _create_auth_response(user)
