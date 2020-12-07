from django.db import models


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

    class Meta:
        ordering = ["date_updated", "id"]
