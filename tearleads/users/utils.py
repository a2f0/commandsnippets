from tearleads.users.models import TearleadsUser


def create_collisionless_user(username, email):
    user, created = TearleadsUser.objects.get_or_create(
        email=email, defaults={"username": username}
    )
    return user
