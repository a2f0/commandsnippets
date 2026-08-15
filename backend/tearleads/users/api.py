from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from tearleads.authentication import utility

from .serializers_edge import UserSerializer


class User(APIView):
    resource_name = "User"

    def get(self, request, *args, **kwargs):
        """
        Serialize user introspection information for the currently logged in user.
        """
        ca = utility.CustomAuthentication()
        authenticated_info = ca.authenticate(request)
        if authenticated_info is None:
            return Response({}, status=status.HTTP_401_UNAUTHORIZED)
        else:
            return Response(
                UserSerializer(
                    instance=authenticated_info[0],
                ).data,
                status=status.HTTP_200_OK,
            )
