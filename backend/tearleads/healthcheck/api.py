from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckAPIView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response(status=status.HTTP_200_OK)
