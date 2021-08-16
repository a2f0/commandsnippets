from rest_framework_json_api import serializers
from rest_framework_json_api.relations import ResourceRelatedField

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.users.serializers import UserSerializer
from tearleads.text_entries.serializers import TextEntrySerializer


class TagSerializer(serializers.ModelSerializer):

    included_serializers = {
        "user": UserSerializer,
    }

    class Meta:
        model = Tag
        fields = (
            "id",
            "name",
            "date_created",
            "date_last_used",
            "date_updated",
            "user",
            "entry_count",
            "order",
        )

    class JSONAPIMeta:
        included_resources = ["user"]


class TagCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("name",)


class TagReorderSerializer(serializers.Serializer):
    def validate(self, attrs):
        return attrs

    def save(self, validated_data):
        top = Tag.objects.get(pk=validated_data["top"])
        bottom = Tag.objects.get(pk=validated_data["bottom"])
        # Django Ordered model method to move object above reference.
        top.above(bottom)
        return None

    top = serializers.PrimaryKeyRelatedField(
        required=True, queryset=Tag.objects.all(), allow_empty=False, many=False
    )

    bottom = serializers.PrimaryKeyRelatedField(
        required=True, queryset=Tag.objects.all(), allow_empty=False, many=False
    )


class TagTextEntryThroughModelSerializer(serializers.ModelSerializer):

    included_serializers = {
        "user": UserSerializer,
        "tag": TagSerializer,
        "text_entry": TextEntrySerializer,
    }

    class Meta:
        model = TagTextEntryThroughModel
        fields = ("id", "tag", "user", "text_entry")

    class JSONAPIMeta:
        included_resources = ["user", "tag", "text_entry"]


class TagTextEntryThroughModelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TagTextEntryThroughModel
        fields = ("tag", "text_entry")
        validators = []


class TagTextEntryThroughModelReorderSerializer(serializers.Serializer):
    def validate(self, attrs):
        return attrs

    def save(self, validated_data):
        top = TagTextEntryThroughModel.objects.get(pk=validated_data["top"])
        bottom = TagTextEntryThroughModel.objects.get(pk=validated_data["bottom"])
        # Django Ordered model method to move object above reference.
        top.above(bottom)
        return None

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
