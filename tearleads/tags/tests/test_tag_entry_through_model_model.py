from tearleads.core.tests.core import BaseTestCase

from .factories import TagFactory, TagTextEntryThroughModelFactory
from tearleads.tags.models import TagTextEntryThroughModel
from tearleads.tags.models import Tag
from tearleads.text_entries.tests.factories import TextEntryFactory


class TestTagsEntriesModel(BaseTestCase):
    def setUp(self):
        super(TestTagsEntriesModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsEntriesModel, cls).setUpTestData()

    def test_tagging_increases_counters(
        self,
    ):
        tag = TagFactory(user=self.user1)
        self.assertEqual(tag.date_last_used, None)
        self.assertEqual(tag.entry_count, 0)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            user=self.user1, tag=tag, text_entry=text_entry
        )
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.tag_count, 1)
        tag.refresh_from_db()
        self.assertEqual(tag.entry_count, 1)
        tag_text_entry.delete()
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.tag_count, 0)
        tag.refresh_from_db()
        self.assertEqual(tag.entry_count, 0)
        self.assertEqual(tag.date_last_used, None)
