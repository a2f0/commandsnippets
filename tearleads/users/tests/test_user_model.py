from django.db.utils import IntegrityError
from django.test import TestCase

from .factories import UserFactory


class TestUserModel(TestCase):
    def setUp(self):
        super(TestUserModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestUserModel, cls).setUpTestData()

    def test_usernames_cannot_be_duplicated(self):
        user1 = UserFactory(username="collide")
        user2 = UserFactory(username="collide")
        self.assertEqual(user1.username, "collide")
        self.assertNotEqual(user2.username, "collide")
        user3 = UserFactory(username=user2.username)
        self.assertNotEqual(user3.username, user2.username)

    def test_usernames_cannot_be_none(self):
        try:
            UserFactory(username=None)
        except IntegrityError:
            pass

    def test_usernames_cannot_be_empty_strings(self):
        try:
            UserFactory(username="")
        except IntegrityError:
            pass

    def test_emails_cannot_be_duplicates(self):
        try:
            UserFactory(email="collide@tearleads.com")
            UserFactory(email="collide@tearleads.com")
        except IntegrityError:
            pass

    def test_emails_cannot_be_none(self):
        try:
            UserFactory(email=None)
        except IntegrityError:
            pass

    def test_emails_cannot_be_empty_strings(self):
        try:
            UserFactory(email="")
        except IntegrityError:
            pass

    def test_date_updated_initialized_for_new_user(self):
        user = UserFactory()
        self.assertNotEqual(user.date_updated, None)
