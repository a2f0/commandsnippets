from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework import authentication
from rest_framework import exceptions

class CustomAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        if 'Authorization' in request.COOKIES:
            token = request.COOKIES['Authorization']
        elif 'Authorization' in request.headers:
            parsed = request.headers['Authorization'].split()
            if len(parsed) != 2:
                return None
            else:
                token = parsed[1]
        else:
            return None

        token = Token.objects.select_related('user').get(key=token)
        if token is not None:
            return(token.user, None)
        else:
            return None