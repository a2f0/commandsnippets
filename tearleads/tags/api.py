from rest_framework import filters, viewsets, response, status
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework_json_api import serializers
from rest_framework_json_api.filters import OrderingFilter
from rest_framework_json_api.django_filters import DjangoFilterBackend

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.tags.serializers import TagSerializer, TagTextEntryThroughModelSerializer, TagTextEntryThroughModelCreateSerializer


class TagViewSet(viewsets.ModelViewSet):
    filter_backends = (OrderingFilter,)
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    ordering_fields = ('date_created','name',)

class TagTextEntryThroughModel(viewsets.ModelViewSet):
    queryset = TagTextEntryThroughModel.objects.all()
    serializer_class = TagTextEntryThroughModelSerializer
    ordering_fields = ('date_created', 'order', 'text_entry__subject', 'text_entry__body')
    permission_classes = (IsAuthenticatedOrReadOnly,)

    filterset_fields = {
       'tag__name': ('exact',),
       'user__username': ('exact',)
    }

    def create(self, request, *args, **kwargs):
        serializer = TagTextEntryThroughModelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            user=request.user
        )
        return response.Response(
            data=TagTextEntryThroughModelSerializer(instance=instance).data,
            status=status.HTTP_201_CREATED
    )