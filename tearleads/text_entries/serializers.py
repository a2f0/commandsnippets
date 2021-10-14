from rest_framework_json_api import serializers
from rest_framework_json_api.relations import ResourceRelatedField

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.tags.serializers_edge import TagSerializer
from tearleads.text_entries.models import TextEntry, TextEntryReused
from tearleads.users.models import User
from tearleads.users.serializers_edge import UserSerializer


class TagTextEntryThroughModelSerializer(serializers.ModelSerializer):

    included_serializers = {"user": UserSerializer, "tag": TagSerializer}

    class Meta:
        model = TagTextEntryThroughModel
        fields = (
            "id",
            "tag",
            "text_entry",
            "order",
            "date_updated",
            "date_created",
            "user_id",
        )

    class JSONAPIMeta:
        included_resources = ["user", "tag", "text_entry"]


class TextEntrySerializer(serializers.ModelSerializer):
    included_serializers = {
        "user": UserSerializer,
        "text_entry_to_tag": TagTextEntryThroughModelSerializer,
        "text_entry_to_tag__tag": TagSerializer,
    }

    class Meta:
        model = TextEntry
        fields = (
            "id",
            "body",
            "subject",
            "date_updated",
            "date_created",
            "reused_count",
            "user",
            "is_deleted",
            "text_entry_to_tag",
            "tag_count",
        )

    class JSONAPIMeta:
        included_resources = ["text_entry_to_tag", "text_entry_to_tag__tag", "user"]


class TextEntryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TextEntry
        fields = ("body", "subject")


class TextEntryReusedSerializer(serializers.ModelSerializer):

    included_serializers = {"user": UserSerializer}

    class Meta:
        model = TextEntryReused
        fields = (
            "id",
            "text_entry",
            "user",
        )


class TextEntryReusedCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TextEntryReused
        fields = ("text_entry",)
