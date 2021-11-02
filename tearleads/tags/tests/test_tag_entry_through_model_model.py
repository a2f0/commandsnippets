from tearleads.core.tests.core import BaseTestCase
from tearleads.tags.models import Tag, TagTextEntryThroughModel
from tearleads.text_entries.tests.factories import TextEntryFactory

from .factories import TagFactory, TagTextEntryThroughModelFactory


class TestTagsEntriesModel(BaseTestCase):
    def setUp(self):
        super(TestTagsEntriesModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsEntriesModel, cls).setUpTestData()

    def test_tag_count(
        self,
    ):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(
            user=self.user1, tag=tag, text_entry=text_entry
        )
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.tag_count, 1)
        tag_text_entry.delete()
        text_entry.refresh_from_db()
        self.assertEqual(text_entry.tag_count, 0)
