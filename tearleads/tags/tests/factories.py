import factory

from tearleads.users.tests.factories import UserFactory

class TagFactory(factory.django.DjangoModelFactory):
    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: 'tag-{0}'.format(n))

    class Meta:
        model = 'tags.Tag'