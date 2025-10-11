from rest_framework import routers

from tearleads.tags import api as tags_api
from tearleads.text_entries import api as text_entries_api

router = routers.SimpleRouter(trailing_slash=False)
router.register(r"entries", text_entries_api.TextEntryViewSet)
router.register(r"entry_reuses", text_entries_api.TextEntryReusedViewset)
router.register(r"tags_entries", tags_api.TagTextEntryThroughModelViewSet)
router.register(r"tags", tags_api.TagViewSet)
