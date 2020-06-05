from rest_framework_json_api import serializers
from rest_framework_json_api.relations import ResourceRelatedField

from tearleads.tags.models import Tag
from tearleads.text_entries.models import TextEntry
from tearleads.users.models import User
from tearleads.users.serializers import UserSerializer


class TextEntrySerializer(serializers.ModelSerializer):

    included_serializers = {
        'user': UserSerializer
    }

    class Meta:
        model = TextEntry
        fields = ('id','body','subject','date_updated','date_created','user')

    class JSONAPIMeta:
        included_resources = ['user',]

class TextEntryCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model = TextEntry
        fields = ('body','subject')
