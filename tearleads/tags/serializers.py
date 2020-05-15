from rest_framework_json_api import serializers
from rest_framework_json_api.relations import ResourceRelatedField

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.users.serializers import UserSerializer


class TagSerializer(serializers.ModelSerializer):

    included_serializers = {
        'user': UserSerializer,
    }

    class Meta:
        model = Tag
        fields = ('id','name','date_created','date_updated','user')

    class JSONAPIMeta:
        included_resources = ['user']

class TagTextEntryThroughModelSerializer(serializers.ModelSerializer):

    included_serializers = {
        'user': UserSerializer,
        'tag': TagSerializer
    }

    class Meta:
        model = TagTextEntryThroughModel
        fields = ('id','tag','user')

    class JSONAPIMeta:
        included_resources = ['user', 'tag']


class TagTextEntryThroughModelCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model = TagTextEntryThroughModel
        fields = ('tag','text_entry')