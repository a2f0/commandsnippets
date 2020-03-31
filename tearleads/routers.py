from rest_framework import routers
from tearleads.text_entries import api as text_entries_api
from tearleads.tags import api as tags_api

router = routers.SimpleRouter()
router.register(r'entries', text_entries_api.TextEntryViewSet)
router.register(r'tags', tags_api.TagViewSet)