import csv
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Count

from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.text_entries.models import TextEntry


class Command(BaseCommand):
    help = "Generates a usage report showing the per-user breakdown of tags, text entries, and tag-text relationships"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            help="Output file path (CSV format)",
        )
        parser.add_argument(
            "--format",
            type=str,
            default="stdout",
            choices=["stdout", "csv"],
            help="Output format (default: stdout)",
        )

    def handle(self, *args, **options):
        output_format = options.get("format")
        output_file = options.get("output")

        User = get_user_model()
        users = User.objects.all()

        # Collect data
        report_data = []
        for user in users:
            tag_count = Tag.objects.filter(user=user).count()
            text_entry_count = TextEntry.objects.filter(user=user).count()
            tag_text_relationship_count = TagTextEntryThroughModel.objects.filter(
                user=user
            ).count()

            report_data.append(
                {
                    "username": user.username,
                    "email": user.email,
                    "tag_count": tag_count,
                    "text_entry_count": text_entry_count,
                    "tag_text_relationship_count": tag_text_relationship_count,
                }
            )

        # Add summary totals
        total_tags = Tag.objects.count()
        total_text_entries = TextEntry.objects.count()
        total_relationships = TagTextEntryThroughModel.objects.count()

        # Display the report
        if output_format == "stdout":
            self.stdout.write(self.style.SUCCESS("=== User Usage Report ==="))
            self.stdout.write(
                f"{'Username':<30} {'Email':<30} {'Tags':<10} {'Entries':<10} {'Relationships':<15}"
            )
            self.stdout.write("-" * 95)

            for data in report_data:
                self.stdout.write(
                    f"{data['username']:<30} {data['email']:<30} {data['tag_count']:<10} "
                    f"{data['text_entry_count']:<10} {data['tag_text_relationship_count']:<15}"
                )

            self.stdout.write("-" * 95)
            self.stdout.write(
                f"{'TOTAL':<30} {'':<30} {total_tags:<10} {total_text_entries:<10} {total_relationships:<15}"
            )

        elif output_format == "csv":
            output = StringIO() if not output_file else None
            fieldnames = [
                "username",
                "email",
                "tag_count",
                "text_entry_count",
                "tag_text_relationship_count",
            ]

            writer = csv.DictWriter(output_file or output, fieldnames=fieldnames)
            writer.writeheader()

            for data in report_data:
                writer.writerow(data)

            # Add a summary row
            writer.writerow(
                {
                    "username": "TOTAL",
                    "email": "",
                    "tag_count": total_tags,
                    "text_entry_count": total_text_entries,
                    "tag_text_relationship_count": total_relationships,
                }
            )

            if not output_file:
                self.stdout.write(output.getvalue())
            else:
                self.stdout.write(self.style.SUCCESS(f"Report saved to {output_file}"))

        # Provide some additional analytics
        top_tag_users = User.objects.annotate(tag_count=Count("tags")).order_by(
            "-tag_count"
        )[:5]
        top_entry_users = User.objects.annotate(entry_count=Count("entries")).order_by(
            "-entry_count"
        )[:5]

        self.stdout.write("\nTop 5 Users by Tag Count:")
        for user in top_tag_users:
            self.stdout.write(f"{user.username}: {user.tag_count} tags")

        self.stdout.write("\nTop 5 Users by Text Entry Count:")
        for user in top_entry_users:
            self.stdout.write(f"{user.username}: {user.entry_count} entries")
