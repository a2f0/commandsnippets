from tearleads.users.models import User


def create_collisionless_user(username, email):
    user, created = User.objects.get_or_create(
        email=email, defaults={"username": username}
    )
    return user
