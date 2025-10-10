from django.conf import settings
from django.db.models import Q
from rest_framework import response, status, viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from tearleads.core.permissions import IsOwner
from tearleads.text_entries.models import TextEntry, TextEntryReused

from .serializers import (
    TextEntryCreateSerializer,
    TextEntryReusedCreateSerializer,
    TextEntryReusedSerializer,
    TextEntrySerializer,
)


class TextEntryViewSet(viewsets.ModelViewSet):
    ordering_fields = ("body", "date_created", "date_updated", "subject")
    permission_classes = (IsAuthenticatedOrReadOnly, IsOwner)
    queryset = TextEntry.objects.all()
    serializer_class = TextEntrySerializer

    select_for_includes = {"user": ["user"], "tags": ["tags"]}

    filterset_fields = {
        "id": ("exact",),
        "tags__name": ("exact",),
        "user__username": ("exact",),
        "tags__id": ("exact",),
        "tag_count": ("exact",),
        "is_deleted": ("exact",),
        "date_updated": ("gt",),
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if settings.REST_FRAMEWORK["SEARCH_PARAM"] in self.request.GET:
            search_term = self.request.GET[settings.REST_FRAMEWORK["SEARCH_PARAM"]]
            queryset = queryset.filter(
                Q(body__icontains=search_term) | Q(subject__icontains=search_term)
            )
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = TextEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)
        return response.Response(
            data=TextEntrySerializer(instance=instance).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()

        return response.Response(
            data=TextEntrySerializer(instance=instance).data, status=status.HTTP_200_OK
        )


class TextEntryReusedViewset(viewsets.ModelViewSet):
    ordering_fields = "date_created"
    permission_classes = (IsAuthenticatedOrReadOnly, IsOwner)
    queryset = TextEntryReused.objects.all()
    serializer_class = TextEntryReusedSerializer

    def create(self, request, *args, **kwargs):
        serializer = TextEntryReusedCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)
        return response.Response(
            data=TextEntryReusedCreateSerializer(instance=instance).data,
            status=status.HTTP_201_CREATED,
        )
