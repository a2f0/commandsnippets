import factory


class UserFactory(factory.django.DjangoModelFactory):
    username = factory.Sequence(lambda n: "user-{0}".format(n))
    email = factory.Sequence(lambda n: "user-{0}@example.com".format(n))

    @classmethod
    def _after_postgeneration(cls, instance, create, results=None):
        instance.set_password("password")
        instance.save()

    class Meta:
        model = "users.User"
