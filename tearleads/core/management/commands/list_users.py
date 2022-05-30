from django.core.management.base import BaseCommand

from tearleads.users.models import User


class Command(BaseCommand):
    help = "List all users."

    def handle(self, *args, **options):

        all_users = User.objects.all()
        for user in all_users:
            print(user.email)
