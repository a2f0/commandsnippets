from rest_framework import filters, viewsets

from rest_framework_json_api import serializers

from tearleads.text_entries.models import TextEntry
from tearleads.text_entries.serializers import TextEntrySerializer

class TextEntryViewSet(viewsets.ModelViewSet):
    queryset = TextEntry.objects.all()
    serializer_class = TextEntrySerializer
    ordering_fields = '__all__'
    search_fields = ('name',)