from django.test import TestCase
from django.db.utils import IntegrityError

from .factories import UserFactory


class TestUserModel(TestCase):
    def setUp(self):
        super(TestUserModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestUserModel, cls).setUpTestData()

    def test_usernames_cannot_be_duplicated(self):
        try:
            user1 = UserFactory(username="collide")
            user2 = UserFactory(username="collide")
        except IntegrityError:
            pass

    def test_usernames_cannot_be_none(self):
        try:
            user1 = UserFactory(username=None)
        except IntegrityError:
            pass

    def test_usernames_cannot_be_empty_strings(self):
        try:
            user1 = UserFactory(username="")
        except IntegrityError:
            pass

    def test_emails_cannot_be_duplicates(self):
        try:
            user1 = UserFactory(email="collide@tearleads.com")
            user2 = UserFactory(email="collide@tearleads.com")
        except IntegrityError:
            pass

    def test_emails_cannot_be_none(self):
        try:
            user1 = UserFactory(email=None)
        except IntegrityError:
            pass

    def test_emails_cannot_be_empty_strings(self):
        try:
            user1 = UserFactory(email="")
        except IntegrityError:
            pass
