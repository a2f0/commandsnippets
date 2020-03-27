from django.db import models

class Tag(models.Model):
    name = models.CharField(max_length=24, unique=True, null=False)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['date_updated','id']