from rest_framework import filters, viewsets
from rest_framework_json_api import serializers
from rest_framework_json_api.filters import OrderingFilter

from tearleads.tags.models import Tag
from tearleads.tags.serializers import TagSerializer


class TagViewSet(viewsets.ModelViewSet):
    filter_backends = (OrderingFilter,)
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    ordering_fields = ('name',)
