from django.db.utils import DataError

from tearleads.core.tests.core import BaseTestCase
from tearleads.text_entries.models import TextEntry

from .factories import TextEntryFactory


class TestTextEntriesModel(BaseTestCase):
    def setUp(self):
        super(TestTextEntriesModel, self).setUp()

    @classmethod
    def TestTextEntriesModel(cls):
        super(TestTextEntriesModel, cls).setUpTestData()

    def test_invalid_body_length(
        self,
    ):

        max_length = TextEntry._meta.get_field("body").max_length
        too_large = max_length + 1
        oversized_body = "x" * too_large
        with self.assertRaisesMessage(
            DataError, f"value too long for type character varying({1024})\n"
        ):
            entry1 = TextEntryFactory(user=self.user1, body=oversized_body)

    def test_invalid_subject_length(
        self,
    ):
        max_length = TextEntry._meta.get_field("subject").max_length
        too_large = max_length + 1
        oversized_subject = "x" * too_large
        with self.assertRaisesMessage(
            DataError, f"value too long for type character varying({255})\n"
        ):
            entry1 = TextEntryFactory(user=self.user1, subject=oversized_subject)
