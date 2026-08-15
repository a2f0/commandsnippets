from rest_framework_json_api import serializers

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.text_entries.serializers import TextEntrySerializer
from tearleads.users.serializers_edge import UserSerializer

from .serializers_edge import TagSerializer


class TagCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("name",)


class TagReorderSerializer(serializers.Serializer):
    top = serializers.PrimaryKeyRelatedField(
        required=True, queryset=Tag.objects.all(), allow_empty=False, many=False
    )

    bottom = serializers.PrimaryKeyRelatedField(
        required=True, queryset=Tag.objects.all(), allow_empty=False, many=False
    )

    class Meta:
        resource_name = False


class TagTextEntryThroughModelSerializer(serializers.ModelSerializer):

    included_serializers = {
        "user": UserSerializer,
        "tag": TagSerializer,
        "text_entry": TextEntrySerializer,
    }

    class Meta:
        model = TagTextEntryThroughModel
        fields = (
            "id",
            "tag",
            "text_entry",
            "order",
            "date_updated",
            "date_created",
            "user",
        )

    class JSONAPIMeta:
        included_resources = ["user", "tag", "text_entry"]


class TagTextEntryThroughModelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TagTextEntryThroughModel
        fields = ("tag", "text_entry")
        validators = []


class TagTextEntryThroughModelReorderSerializer(serializers.Serializer):

    top = serializers.PrimaryKeyRelatedField(
        required=True,
        queryset=TagTextEntryThroughModel.objects.all(),
        allow_empty=False,
        many=False,
    )

    bottom = serializers.PrimaryKeyRelatedField(
        required=True,
        queryset=TagTextEntryThroughModel.objects.all(),
        allow_empty=False,
        many=False,
    )

    class Meta:
        resource_name = False
