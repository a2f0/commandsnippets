from rest_framework import filters, viewsets, response, status
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework_json_api import serializers
from rest_framework_json_api.filters import OrderingFilter
from rest_framework_json_api.django_filters import DjangoFilterBackend

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.tags.serializers import (
    TagSerializer,
    TagTextEntryThroughModelSerializer,
    TagTextEntryThroughModelCreateSerializer,
    TagCreateSerializer,
)


class TagViewSet(viewsets.ModelViewSet):
    filter_backends = (OrderingFilter,)
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    ordering_fields = (
        "date_last_used",
        "date_created",
        "entry_count",
        "name",
    )

    permission_classes = (IsAuthenticatedOrReadOnly,)

    def create(self, request, *args, **kwargs):
        serializer = TagCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)
        return response.Response(
            data=TagSerializer(instance=instance).data, status=status.HTTP_201_CREATED
        )


class TagTextEntryThroughModelViewSet(viewsets.ModelViewSet):
    queryset = TagTextEntryThroughModel.objects.all()
    serializer_class = TagTextEntryThroughModelSerializer
    ordering_fields = (
        "date_created",
        "order",
        "text_entry__subject",
        "text_entry__body",
        "text_entry__date_created",
        "text_entry__date_updated",
        "text_entry__tag_count",
    )
    permission_classes = (IsAuthenticatedOrReadOnly,)

    filterset_fields = {"tag__name": ("exact",), "user__username": ("exact",)}

    def create(self, request, *args, **kwargs):
        serializer = TagTextEntryThroughModelCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text_entry = serializer.validated_data.pop("text_entry")
        tag = serializer.validated_data.pop("tag")

        instance, created = TagTextEntryThroughModel.objects.get_or_create(
            user=request.user,
            tag=tag,
            text_entry=text_entry,
            defaults=dict(),
        )

        return response.Response(
            data=TagTextEntryThroughModelSerializer(instance=instance).data,
            status=status.HTTP_201_CREATED,
        )
