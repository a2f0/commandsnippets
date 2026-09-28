/**
 * JSON:API resource type names (DJA's `resource_name`): what documents carry
 * in `type` and what request documents must match. `No <type> matches the
 * given query.` 404s name them too.
 */
export const USER = 'User';
export const TAG = 'Tag';
export const TEXT_ENTRY = 'TextEntry';
export const TAG_TEXT_ENTRY = 'TagTextEntryThroughModel';
export const TEXT_ENTRY_REUSED = 'TextEntryReused';

export const ADMIN_USER = 'AdminUser';
export const ADMIN_AUDIT_LOG_ENTRY = 'AdminAuditLogEntry';

/** Login request documents; nothing is ever rendered with these types. */
export const GITHUB_LOGIN = 'GithubLogin';
export const GOOGLE_LOGIN = 'GoogleLogin';
