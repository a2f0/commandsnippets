from django.db import models


class TextEntry(models.Model):
    body = models.CharField(max_length=1024, unique=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    subject = models.CharField(max_length=255, unique=True)
    user = models.ForeignKey('users.User', related_name='text_entries', null=False, on_delete=models.CASCADE)
    class Meta:
        ordering = ['date_updated','id']
