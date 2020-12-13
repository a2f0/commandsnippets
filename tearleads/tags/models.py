from django.db import models
from django.db.models import F
from django.db.models.signals import post_save, post_delete
from ordered_model.models import OrderedModel

from tearleads.text_entries.models import TextEntry


class Tag(models.Model):
    name = models.CharField(max_length=24, unique=True, null=False)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    entry_count = models.IntegerField(default=0, null=False)
    text_entries = models.ManyToManyField(
        "text_entries.TextEntry",
        related_name="tags",
        blank=True,
        through="TagTextEntryThroughModel",
    )
    user = models.ForeignKey(
        "users.User", related_name="tags", null=False, on_delete=models.CASCADE
    )

    class Meta:
        ordering = ["date_updated", "id"]


class TagTextEntryThroughModel(OrderedModel):
    tag = models.ForeignKey(
        Tag, on_delete=models.CASCADE, related_name="tag_to_text_entry"
    )
    text_entry = models.ForeignKey(
        TextEntry, on_delete=models.CASCADE, related_name="text_entry_to_tag"
    )
    user = models.ForeignKey(
        "users.User", related_name="tags_entries", null=False, on_delete=models.CASCADE
    )
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date_updated", "id"]
        unique_together = ("tag", "text_entry")


def update_counter_increment(sender, instance, created, **kwargs):
    if created:
        text_tag_entry_through_model = instance
        text_entry = text_tag_entry_through_model.text_entry
        text_entry.tag_count = F("tag_count") + 1
        text_entry.save(update_fields=["tag_count"])

        tag = text_tag_entry_through_model.tag
        tag.entry_count = F("entry_count") + 1
        tag.save(update_fields=["entry_count"])
        tag.refresh_from_db()


post_save.connect(update_counter_increment, sender=TagTextEntryThroughModel)


def update_counter_decrement(sender, instance, **kwargs):
    text_tag_entry_through_model = instance
    text_entry = text_tag_entry_through_model.text_entry
    text_entry.tag_count = F("tag_count") - 1
    text_entry.save(update_fields=["tag_count"])

    tag = text_tag_entry_through_model.tag
    tag.entry_count = F("entry_count") - 1
    tag.save(update_fields=["entry_count"])


post_delete.connect(update_counter_decrement, sender=TagTextEntryThroughModel)
