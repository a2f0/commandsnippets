import datetime

from django.db import models
from django.db.models import F
from django.db.models.signals import post_delete, post_save


class TextEntry(models.Model):
    body = models.CharField(max_length=1024)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    subject = models.CharField(max_length=255)
    user = models.ForeignKey(
        "users.User", related_name="text_entries", null=False, on_delete=models.CASCADE
    )
    is_deleted = models.BooleanField(default=False)
    tag_count = models.IntegerField(default=0, null=False)
    reused_count = models.IntegerField(default=0, null=False)
    reused_date = models.DateTimeField(auto_now=False, null=True)

    class Meta:
        ordering = ["date_updated", "id"]


class TextEntryReused(models.Model):
    date_created = models.DateTimeField(auto_now_add=True)
    text_entry = models.ForeignKey(
        TextEntry, on_delete=models.CASCADE, related_name="text_entry_resuses"
    )
    user = models.ForeignKey(
        "users.User",
        related_name="text_entry_resuses",
        null=False,
        on_delete=models.CASCADE,
    )

    class Meta:
        ordering = ["date_created", "id"]


def update_counter_increment(sender, instance, created, **kwargs):
    if created:
        text_entry_reused_model = instance
        text_entry = text_entry_reused_model.text_entry
        text_entry.reused_count = F("reused_count") + 1
        text_entry.reused_date = datetime.datetime.now()
        text_entry.save(update_fields=["reused_count", "reused_date"])


post_save.connect(update_counter_increment, sender=TextEntryReused)


def update_counter_decrement(sender, instance, **kwargs):
    text_entry_reused_model = instance
    text_entry = text_entry_reused_model.text_entry
    text_entry.reused_count = F("reused_count") - 1
    text_entry.reused_date = datetime.datetime.now()
    text_entry.save(update_fields=["reused_count", "reused_date"])


post_delete.connect(update_counter_decrement, sender=TextEntryReused)
