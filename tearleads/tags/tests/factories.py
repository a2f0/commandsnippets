import factory

from tearleads.text_entries.tests.factories import TextEntryFactory
from tearleads.users.tests.factories import UserFactory


class TagFactory(factory.django.DjangoModelFactory):
    user = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: 'tag-{0}'.format(n))

    class Meta:
        model = 'tags.Tag'

class TagTextEntryThroughModelFactory(factory.django.DjangoModelFactory):
    tag = factory.SubFactory(TagFactory)
    text_entry = factory.SubFactory(TextEntryFactory)
    order = 0
    
    class Meta:
        model = 'tags.TagTextEntryThroughModel'
