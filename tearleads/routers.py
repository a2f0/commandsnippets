from rest_framework import routers
from tearleads.text_entries import api as text_entries_api

router = routers.SimpleRouter()
router.register(r'entries', text_entries_api.TextEntryViewSet)