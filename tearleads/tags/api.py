from rest_framework import filters, viewsets

from rest_framework_json_api import serializers

from tearleads.tags.models import Tag
from tearleads.tags.serializers import TagSerializer

class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
