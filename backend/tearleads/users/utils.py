from tearleads.users.models import User


def create_collisionless_user(username, email):
    # The collisionless creation is in the .save() method of the User model.
    user, created = User.objects.get_or_create(
        email=email, defaults={"username": username}
    )
    return user, created
