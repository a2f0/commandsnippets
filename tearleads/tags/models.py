from django.db import models

from ordered_model.models import OrderedModel

from tearleads.text_entries.models import TextEntry

class Tag(models.Model):
    name = models.CharField(max_length=24, unique=True, null=False)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    text_entries = models.ManyToManyField('text_entries.TextEntry', related_name='tags', blank=True, through='TagTextEntryThroughModel')
    user = models.ForeignKey('users.User', related_name='tags', null=False, on_delete=models.CASCADE)
    class Meta:
        ordering = ['date_updated','id']

class TagTextEntryThroughModel(OrderedModel):
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='tag_to_text_entry')
    text_entry = models.ForeignKey(TextEntry, on_delete=models.CASCADE, related_name='text_entry_to_tag')
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
