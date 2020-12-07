import factory

from tearleads.users.tests.factories import UserFactory


class TextEntryFactory(factory.django.DjangoModelFactory):
    user = factory.SubFactory(UserFactory)
    subject = factory.Sequence(lambda n: "subject-{0}".format(n))
    body = factory.Sequence(lambda n: "body-{0}".format(n))

    class Meta:
        model = "text_entries.TextEntry"
