from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework import authentication
from rest_framework import exceptions

class CustomAuthentication(authentication.BaseAuthentication):
    def get_token_from_request(self, request):
        if 'Authorization' in request.COOKIES:
            token = request.COOKIES['Authorization']
            return Token.objects.select_related('user').get(key=token)
        if 'Authorization' in request.headers:
            parsed = request.headers['Authorization'].split()
            if len(parsed) != 2:
                return None
            return Token.objects.select_related('user').get(key=parsed[1])
        return None
    
    def authenticate(self, request):
        token_from_request = self.get_token_from_request(request)
        if token_from_request is not None:
            return(token_from_request.user, None)
        else:
            return None

    def deauthenticate(self,request):
        token_from_request = self.get_token_from_request(request)
        if token_from_request is not None:
            token_from_request.delete()