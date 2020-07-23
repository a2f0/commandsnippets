from django.core.management.base import BaseCommand

from tearleads.text_entries.models import TextEntry

class Command(BaseCommand):
    help = 'Initialize tag counts for text entries.'

    def handle(self, *args, **options):
        all_text_entries = TextEntry.objects.all()
        for text_entry in all_text_entries:
            text_entry.tag_count = text_entry.text_entry_to_tag.count()
            text_entry.save(update_fields=['tag_count'])