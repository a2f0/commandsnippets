from rest_framework import filters, viewsets
from rest_framework_json_api import serializers
from rest_framework_json_api.django_filters import DjangoFilterBackend
from rest_framework_json_api.filters import OrderingFilter

from tearleads.text_entries.models import TextEntry
from tearleads.text_entries.serializers import TextEntrySerializer


class TextEntryViewSet(viewsets.ModelViewSet):
    queryset = TextEntry.objects.all()
    serializer_class = TextEntrySerializer
    filter_backends = (DjangoFilterBackend, OrderingFilter)
    ordering_fields = ('body','date_created','date_updated','subject')

    select_for_includes = {
        'user': ['user'],
        'tags': ['tags']
    }

    filterset_fields = {
       'id': ('exact',),
       'tags__name': ('exact',),
       'tags__id': ('exact',)
    }
