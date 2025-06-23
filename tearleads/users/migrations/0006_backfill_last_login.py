from django.db import migrations


def backfill_last_login(apps, schema_editor):
    User = apps.get_model("users", "User")

    # Find all users with null last_login
    users_to_update = User.objects.filter(last_login__isnull=True)

    for user in users_to_update:
        # Set last_login to date_joined
        user.last_login = user.date_joined
        user.save(update_fields=["last_login"])

    print(f"Updated last_login for {users_to_update.count()} users")


def reverse_backfill(apps, schema_editor):
    # No need to reverse anything as this is a data enrichment migration
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_user_date_updated"),
    ]

    operations = [
        migrations.RunPython(backfill_last_login, reverse_backfill),
    ]
