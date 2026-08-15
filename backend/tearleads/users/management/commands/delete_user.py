from django.core.management.base import BaseCommand

from tearleads.users.models import User


class Command(BaseCommand):
    help = "Completely delete a user."

    def add_arguments(self, parser):
        parser.add_argument(
            "username", type=str, help="The name of the user to be deleted."
        )

    def handle(self, *args, **options):

        user = User.objects.get(username=options["username"])
        user.delete()
