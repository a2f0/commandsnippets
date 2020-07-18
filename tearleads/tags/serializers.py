from rest_framework_json_api import serializers
from rest_framework_json_api.relations import ResourceRelatedField

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.users.serializers import UserSerializer
from tearleads.text_entries.serializers import TextEntrySerializer


class TagSerializer(serializers.ModelSerializer):

    included_serializers = {
        'user': UserSerializer,
    }

    class Meta:
        model = Tag
        fields = ('id','name','date_created','date_updated','user')

    class JSONAPIMeta:
        included_resources = ['user']

class TagCreateSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Tag
        fields = ('name',)

class TagTextEntryThroughModelSerializer(serializers.ModelSerializer):

    included_serializers = {
        'user': UserSerializer,
        'tag': TagSerializer,
        'text_entry': TextEntrySerializer
    }

    class Meta:
        model = TagTextEntryThroughModel
        fields = ('id','tag','user','text_entry')

    class JSONAPIMeta:
        included_resources = ['user', 'tag', 'text_entry']


class TagTextEntryThroughModelCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model = TagTextEntryThroughModel
        fields = ('tag','text_entry')