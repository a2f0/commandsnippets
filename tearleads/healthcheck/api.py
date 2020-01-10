from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions
from rest_framework import status

class HealthCheckAPIView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        print("GET")
        return Response(status=status.HTTP_200_OK)