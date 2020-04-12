from rest_framework import routers

from tearleads.tags import api as tags_api
from tearleads.text_entries import api as text_entries_api

router = routers.SimpleRouter(trailing_slash=False)
router.register(r'entries', text_entries_api.TextEntryViewSet)
router.register(r'tags', tags_api.TagViewSet)
