from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility
from tearleads.users.models import User

from .serializers_edge import UserSerializer


class User(APIView):
    resource_name = "User"

    def get(self, request, *args, **kwargs):
        ca = utility.CustomAuthentication()
        authenticated_info = ca.authenticate(request)
        return Response(
            UserSerializer(
                instance=authenticated_info[0],
            ).data,
            status=status.HTTP_200_OK,
        )
        serializer = UserSerializer(data=request.data)
