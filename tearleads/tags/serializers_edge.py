from rest_framework_json_api import serializers
from tearleads.tags.models import Tag
from tearleads.users.serializers_edge import UserSerializer


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
