import factory

from tearleads.users.tests.factories import UserFactory

class TagFactory(factory.django.DjangoModelFactory):
    name = factory.Sequence(lambda n: 'tag-{0}'.format(n))

    class Meta:
        model = 'tags.TagEntry'