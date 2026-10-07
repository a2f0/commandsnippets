/**
 * Resource type names (DJA's `resource_name`): what documents carry in
 * `type`, what request documents must match, and what `No <type> matches the
 * given query.` 404s name. Then the relationships between them.
 */
import type {RelationshipGraph} from '../include';

export const USER = 'User';
export const TAG = 'Tag';
export const TEXT_ENTRY = 'TextEntry';
export const TAG_TEXT_ENTRY = 'TagTextEntryThroughModel';
export const TEXT_ENTRY_REUSED = 'TextEntryReused';

export const ADMIN_USER = 'AdminUser';
export const DATA_VERSION = 'DataVersion';
export const ADMIN_AUDIT_LOG_ENTRY = 'AdminAuditLogEntry';

/** Login request documents; nothing is ever rendered with these types. */
export const GITHUB_LOGIN = 'GithubLogin';
export const GOOGLE_LOGIN = 'GoogleLogin';

/**
 * The relationships each resource renders, in rendering order, and what
 * `include` can walk. The admin resources have none.
 */
export const RELATIONSHIPS = {
  [USER]: {},
  [TAG]: {user: {type: USER}},
  [TEXT_ENTRY]: {
    user: {type: USER},
    text_entry_to_tag: {type: TAG_TEXT_ENTRY, many: true},
  },
  [TAG_TEXT_ENTRY]: {
    tag: {type: TAG},
    text_entry: {type: TEXT_ENTRY},
    user: {type: USER},
  },
  [TEXT_ENTRY_REUSED]: {
    text_entry: {type: TEXT_ENTRY},
    user: {type: USER},
  },
} as const satisfies RelationshipGraph;

export type ResourceType = keyof typeof RELATIONSHIPS;

/**
 * What `included` holds when a request has no `include` (DJA's
 * `JSONAPIMeta.included_resources`).
 */
export const DEFAULT_INCLUDES = {
  [USER]: [],
  [TAG]: ['user'],
  [TEXT_ENTRY]: ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user'],
  [TAG_TEXT_ENTRY]: ['user', 'tag', 'text_entry'],
  [TEXT_ENTRY_REUSED]: [],
} as const satisfies Record<ResourceType, readonly string[]>;
