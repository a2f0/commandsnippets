from django.apps import AppConfig


class TearleadsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tearleads"

    def ready(self):
        """Import CORS signal handlers when Django starts."""
        import tearleads.cors_config  # noqa
