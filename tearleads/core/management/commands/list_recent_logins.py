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

        widths = {"username": 25, "email": 40, "last_login": 25, "date_joined": 25}

        # Print header
        self.stdout.write(self.style.SUCCESS(f"Total users: {user_count}"))

        # Print headers
        header_row = []
        for field in fields:
            header_row.append(f"{field:<{widths[field]}}")
        self.stdout.write(self.style.MIGRATE_HEADING(" | ".join(header_row)))

        # Calculate total line length for separator
        total_width = (
            sum(widths.values()) + (3 * len(fields)) - 3
        )  # Account for separators
        self.stdout.write("-" * total_width)

        # Print user data row by row
        for user in users:
            row_data = []
            for field in fields:
                value = getattr(user, field)
                field_width = widths[field]
                # Truncate and format values that might be too long
                if isinstance(value, str) and len(value) > field_width:
                    value = value[: field_width - 3] + "..."
                row_data.append(f"{str(value):<{field_width}}")

            self.stdout.write(" | ".join(row_data))

        return f"Found {user_count} users"
