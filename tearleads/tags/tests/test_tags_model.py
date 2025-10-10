from django.db.utils import DataError

from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TagFactory, TagTextEntryThroughModelFactory


class TestTagsModel(BaseTestCase):
    def setUp(self):
        super(TestTagsModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsModel, cls).setUpTestData()

    def test_deleting_tag_deletes_junction_and_leaves_entry_and_updates_tag_count(
        self,
    ):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            user=self.user1, tag=tag, text_entry=text_entry
        )
        text_entry.refresh_from_db()
        tag.delete()
        self.assertEqual(text_entry.tag_count, 1)
        with self.assertRaisesMessage(
            Tag.DoesNotExist, "Tag matching query does not exist"
        ):
            tag.refresh_from_db()
        with self.assertRaisesMessage(
            TagTextEntryThroughModel.DoesNotExist,
            "TagTextEntryThroughModel matching query does not exist",
        ):
            tag_text_entry.refresh_from_db()
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.tag_count, 0)

    def test_date_last_used(
        self,
    ):
        tag = TagFactory(user=self.user1)
        # date_last_used should be close to date_created (within 1 second)
        time_diff = abs((tag.date_last_used - tag.date_created).total_seconds())
        self.assertLess(time_diff, 1.0)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            user=self.user1, tag=tag, text_entry=text_entry
        )
        tag.refresh_from_db()
        self.assertIsNotNone(tag.date_last_used)
        tag_text_entry.delete()
        tag.refresh_from_db()
        # After deleting, date_last_used should again be close to date_created
        time_diff = abs((tag.date_last_used - tag.date_created).total_seconds())
        self.assertLess(time_diff, 1.0)

    def test_entry_count(
        self,
    ):
        tag = TagFactory(user=self.user1)
        self.assertEqual(tag.entry_count, 0)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            user=self.user1, tag=tag, text_entry=text_entry
        )
        tag.refresh_from_db()
        self.assertEqual(tag.entry_count, 1)
        tag_text_entry.delete()
        tag.refresh_from_db()
        self.assertEqual(tag.entry_count, 0)

    def test_invalid_name_length(
        self,
    ):
        max_length = Tag._meta.get_field("name").max_length
        too_large = max_length + 1
        oversized_name = "x" * too_large
        with self.assertRaisesMessage(
            DataError, f"value too long for type character varying({24})\n"
        ):
            TagFactory(user=self.user1, name=oversized_name)
