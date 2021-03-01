from django.test import TestCase
from django.db.utils import IntegrityError

from .factories import TearleadsUserFactory


class TestTearleadsUserModel(TestCase):
    def setUp(self):
        super(TestTearleadsUserModel, self).setUp()

    @classmethod
    def setUpTestData(cls):
        super(TestTearleadsUserModel, cls).setUpTestData()

    def test_usernames_cannot_be_duplicated(self):
        try:
            user1 = TearleadsUserFactory(username="collide")
            user2 = TearleadsUserFactory(username="collide")
        except IntegrityError:
            pass

    def test_usernames_cannot_be_none(self):
        try:
            user1 = TearleadsUserFactory(username=None)
        except IntegrityError:
            pass

    def test_usernames_cannot_be_empty_strings(self):
        try:
            user1 = TearleadsUserFactory(username="")
        except IntegrityError:
            pass

    def test_emails_cannot_be_duplicates(self):
        try:
            user1 = TearleadsUserFactory(email="collide@tearleads.com")
            user2 = TearleadsUserFactory(email="collide@tearleads.com")
        except IntegrityError:
            pass

    def test_emails_cannot_be_none(self):
        try:
            user1 = TearleadsUserFactory(email=None)
        except IntegrityError:
            pass

    def test_emails_cannot_be_empty_strings(self):
        try:
            user1 = TearleadsUserFactory(email="")
        except IntegrityError:
            pass
