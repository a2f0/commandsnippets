from tearleads.core.tests.core import BaseTestCase

from .factories import TagFactory, TagTextEntryThroughModelFactory
from tearleads.tags.models import TagTextEntryThroughModel
from tearleads.tags.models import Tag
from tearleads.text_entries.tests.factories import TextEntryFactory


class TestTagsModel(BaseTestCase):

    def setUp(self):
        super(TestTagsModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTagsModel, cls).setUpTestData()

    def test_deleting_tag_deletes_junction_and_leaves_entry(self):
        tag = TagFactory(user=self.user1)
        text_entry = TextEntryFactory(user=self.user1)
        tag_text_entry = TagTextEntryThroughModelFactory(user=self.user1, tag=tag, text_entry=text_entry)
        tag.delete()
        with self.assertRaisesMessage(Tag.DoesNotExist, 'Tag matching query does not exist'):
            tag.refresh_from_db()
        with self.assertRaisesMessage(TagTextEntryThroughModel.DoesNotExist, 'TagTextEntryThroughModel matching query does not exist'):
            tag_text_entry.refresh_from_db()
        text_entry.refresh_from_db()