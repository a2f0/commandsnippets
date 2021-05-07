from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.core.validators import MinLengthValidator
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from django.db import models
import string
import random


class User(AbstractUser):
    def save(self, *args, **kwargs):
        if not self.pk:
            # then it is a new object
            original_username = self.username
            username_to_test = self.username
            collides = True
            random_length = 1
            while collides == True:
                collides = User.objects.filter(username=username_to_test).exists()
                if collides == True:
                    username_characters = string.digits
                    add_to_username = "".join(
                        random.choice(username_characters) for i in range(random_length)
                    )
                    username_to_test = original_username + "-" + add_to_username
                    random_length += 1
                if collides == False:
                    self.username = username_to_test
        super(User, self).save(*args, **kwargs)


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.create(user=instance)


class TearleadsUser(models.Model):
    username = models.CharField(max_length=254, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["date_updated", "id"]
