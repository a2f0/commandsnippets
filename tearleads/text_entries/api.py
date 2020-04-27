from rest_framework import filters, response, status, viewsets
from rest_framework_json_api import serializers
from rest_framework_json_api.django_filters import DjangoFilterBackend
from rest_framework_json_api.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from tearleads.text_entries.models import TextEntry
from tearleads.text_entries.serializers import TextEntryCreateSerializer, TextEntrySerializer


class TextEntryViewSet(viewsets.ModelViewSet):
    filter_backends = (DjangoFilterBackend, OrderingFilter)
    ordering_fields = ('body','date_created','date_updated','subject')
    permission_classes = (IsAuthenticatedOrReadOnly,)
    queryset = TextEntry.objects.all()
    serializer_class = TextEntrySerializer

    select_for_includes = {
        'user': ['user'],
        'tags': ['tags']
    }

    filterset_fields = {
       'id': ('exact',),
       'tags__name': ('exact',),
       'tags__id': ('exact',)
    }

    def create(self, request, *args, **kwargs):
        serializer = TextEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            user=request.user
        )
        return response.Response(
            data=TextEntrySerializer(instance=instance).data,
            status=status.HTTP_201_CREATED
        )
