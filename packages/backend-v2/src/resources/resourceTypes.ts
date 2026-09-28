/**
 * JSON:API resource type names (DJA's `resource_name`), from the api-shared
 * contract: what documents carry in `type` and what request documents must
 * match. `No <type> matches the given query.` 404s name them too.
 */
export {
  ADMIN_AUDIT_LOG_ENTRY,
  ADMIN_USER,
  GITHUB_LOGIN,
  GOOGLE_LOGIN,
  TAG,
  TAG_TEXT_ENTRY,
  TEXT_ENTRY,
  TEXT_ENTRY_REUSED,
  USER,
} from '@commandsnippets/api-shared';
