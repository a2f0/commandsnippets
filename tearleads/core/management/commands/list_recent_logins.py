from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Lists all users ordered by most recently logged in"

    def handle(self, *args, **options):
        # Get the current timestamp
        self.stdout.write(
            self.style.SUCCESS(
                f"Running user query at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
        )

        users = User.objects.all().order_by("-last_login")

        user_count = users.count()

        # Only include specified fields
        fields = ["username", "email", "last_login", "date_joined"]

        # Print header
        self.stdout.write(self.style.SUCCESS(f"Total users: {user_count}"))

        # Print headers
        self.stdout.write(
            self.style.MIGRATE_HEADING(" | ".join(f"{field:<25}" for field in fields))
        )
        self.stdout.write("-" * (27 * len(fields)))

        # Print user data row by row
        for user in users:
            row_data = []
            for field in fields:
                value = getattr(user, field)
                # Truncate and format values that might be too long
                if isinstance(value, str) and len(value) > 25:
                    value = value[:22] + "..."
                row_data.append(f"{str(value):<25}")

            self.stdout.write(" | ".join(row_data))

        return f"Found {user_count} users"
