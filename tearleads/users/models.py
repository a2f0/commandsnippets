import random
import string

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinLengthValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.text_entries.models import TextEntry


class User(AbstractUser):
    date_updated = models.DateTimeField(auto_now=True)
    login_count = models.PositiveIntegerField(default=1)

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

            # Set last_login to the same as date_joined for new users
            self.last_login = self.date_joined
            # Initialize the login count for new user
            self.login_count = 1
        super(User, self).save(*args, **kwargs)


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.create(user=instance)
        # create some stub data for whe the user initially logs in
        tag1 = Tag.objects.create(user=instance, order=1, name="example-postgres")
        tag2 = Tag.objects.create(user=instance, order=2, name="example-tag-2")

        entry1_subject = "close all postgres connections other than the current one"
        entry1_body = (
            "SELECT pg_terminate_backend(pg_stat_activity.pid)\n"
            "FROM pg_stat_activity\n"
            "WHERE datname = current_database()\n"
            "AND pid <> pg_backend_pid();\n"
        )
        entry1 = TextEntry.objects.create(
            user=instance, subject=entry1_subject, body=entry1_body
        )

        entry2_subject = "show where a postgres session is originating from"
        entry2_body = (
            "SELECT *\n" "FROM pg_stat_activity\n" "WHERE datname = 'postgres';"
        )
        entry2 = TextEntry.objects.create(
            user=instance,
            subject=entry2_subject,
            body=entry2_body,
        )

        tag_text_entry_1 = TagTextEntryThroughModel.objects.create(
            user=instance,
            tag=tag1,
            text_entry=entry1,
            order=1,
        )
        tag_text_entry_2 = TagTextEntryThroughModel.objects.create(
            user=instance,
            tag=tag1,
            text_entry=entry2,
            order=2,
        )
        tag_text_entry_3 = TagTextEntryThroughModel.objects.create(
            user=instance,
            tag=tag2,
            text_entry=entry2,
            order=3,
        )
