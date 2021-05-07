import os
import requests


class GoogleOAuthService(object):
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
