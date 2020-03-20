from rest_framework_json_api import serializers

from tearleads.text_entries.models import TextEntry

class TextEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TextEntry
        fields = ('id','body', 'subject','date_updated','date_created')