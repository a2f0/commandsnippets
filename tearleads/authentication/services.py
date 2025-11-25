import os

import requests
from django.core.exceptions import ImproperlyConfigured


class GoogleOAuthService(object):
    def __init__(self):
        self.client_secret = os.environ["GOOGLE_CLIENT_SECRET"]
        self.client_id = os.environ["GOOGLE_CLIENT_ID"]
        self.redirect_uri = os.environ["GOOGLE_REDIRECT_URI"]

    def access_token(self, code):
        data = {
            "client_id": self.client_id,
            "code": code,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        response = requests.post(url="https://oauth2.googleapis.com/token", data=data)
        return response

    def user(self, access_token):
        response = requests.get(
            url="https://www.googleapis.com/oauth2/v3/userinfo"
            + "?access_token="
            + access_token
        )
        return response


class GithubOAuthService(object):
    def __init__(self, clientType="web"):
        if clientType == "electron":
            self.client_secret = os.environ.get("ELECTRON_GITHUB_CLIENT_SECRET")
            self.client_id = os.environ.get("ELECTRON_GITHUB_CLIENT_ID")
            self.redirect_uri = os.environ.get("ELECTRON_GITHUB_REDIRECT_URI")

            if not all((self.client_secret, self.client_id, self.redirect_uri)):
                raise ImproperlyConfigured(
                    "ELECTRON_GITHUB_CLIENT_SECRET, ELECTRON_GITHUB_CLIENT_ID, "
                    "and ELECTRON_GITHUB_REDIRECT_URI must be set in "
                    "environment variables."
                )
        else:
            self.client_secret = os.environ.get("GITHUB_CLIENT_SECRET")
            self.client_id = os.environ.get("GITHUB_CLIENT_ID")
            self.redirect_uri = os.environ.get("GITHUB_REDIRECT_URI")

            if not all((self.client_secret, self.client_id, self.redirect_uri)):
                raise ImproperlyConfigured(
                    "GITHUB_CLIENT_SECRET, GITHUB_CLIENT_ID, "
                    "and GITHUB_REDIRECT_URI must be set in environment variables."
                )

    def headers(self, access_token):
        authorization_header = "token " + access_token
        headers = {"Authorization": authorization_header}
        return headers

    def access_token(self, code):
        data = {
            "client_id": self.client_id,
            "code": code,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
        }
        response = requests.post(
            url="https://github.com/login/oauth/access_token", data=data
        )
        return response

    def user(self, access_token):
        response = requests.get(
            url="https://api.github.com/user", headers=self.headers(access_token)
        )
        return response

    def emails(self, access_token):
        response = requests.get(
            url="https://api.github.com/user/emails", headers=self.headers(access_token)
        )
        return response
