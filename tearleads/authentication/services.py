import os

import requests


class GoogleOAuthService(object):
    def __init__(self, request=None):
        self.client_secret = os.environ["GOOGLE_CLIENT_SECRET"]
        self.client_id = os.environ["GOOGLE_CLIENT_ID"]

        # Build redirect URI dynamically based on request if available
        if request:
            host = request.get_host()
            # Check if we're using HTTPS (production) or HTTP (local dev)
            protocol = "https" if request.is_secure() else "http"
            self.redirect_uri = f"{protocol}://{host}/auth/google/callback"
        else:
            # Fall back to environment variable if no request provided
            self.redirect_uri = os.environ.get(
                "GOOGLE_REDIRECT_URI", "http://localhost:9001/auth/google/callback"
            )

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
    def __init__(self):
        self.client_secret = os.environ["GITHUB_CLIENT_SECRET"]
        self.client_id = os.environ["GITHUB_CLIENT_ID"]

    def headers(self, access_token):
        authorization_header = "token " + access_token
        headers = {"Authorization": authorization_header}
        return headers

    def access_token(self, code):
        data = {
            "client_id": os.environ["GITHUB_CLIENT_ID"],
            "code": code,
            "client_secret": os.environ["GITHUB_CLIENT_SECRET"],
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
