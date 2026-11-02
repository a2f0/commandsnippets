/** The admin API: users, their data (read-only), and the audit log. */
import {
  type AdminAuditAction,
  type AdminAuditLogEntry,
  type AdminUser,
  type AdminUserUpdateAttributes,
  adminUserUpdateAttributesSchema,
  CODES,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {listDocument} from '../documents';
import type {MockAdminUser, MockAuditEntry} from '../fixtures';
import {
  adminDataOf,
  changedSince,
  collectionResponse,
  revisionPage,
} from '../reads';
import {apiError, parseResource, validateFields} from '../requests';
import {type RouteInfo, route, SIGNED_IN_USER} from '../route';
import {findOr404, junctionsOf} from '../rows';
import {adminAuditLog, adminUsers} from '../state';

const adminUserResource = (user: MockAdminUser): AdminUser => ({
  type: 'AdminUser',
  id: user.id,
  attributes: {
    username: user.username,
    email: user.email,
    is_staff: user.is_staff,
    is_active: user.is_active,
    date_joined: '2026-01-02T03:04:05.000000',
    last_login: '2026-09-01T00:00:00.000000',
    last_active: '2026-09-02T00:00:00.000000',
    login_count: 4,
    date_updated: '2026-09-01T00:00:00.000000',
    date_marked_for_deletion: user.date_marked_for_deletion,
    entry_count: 12,
    tag_count: 3,
    data_version: 1,
  },
});

const adminAuditLogResource = (entry: MockAuditEntry): AdminAuditLogEntry => ({
  type: 'AdminAuditLogEntry',
  id: entry.id,
  attributes: {
    created: entry.created,
    action: entry.action,
    actor_id: '1',
    actor_username: 'test',
    target_user_id: null,
    target_username: entry.target,
  },
});

/**
 * The users, filtered as the API filters them: `filter[search]` a
 * case-insensitive substring of the username or email.
 */
function listAdminUsers({request}: RouteInfo) {
  const params = new URL(request.url).searchParams;
  const search = params.get('filter[search]')?.toLowerCase();
  const active = params.get('filter[is_active]');
  const username = params.get('filter[username]');
  const matching = adminUsers.filter(
    user =>
      (search === undefined ||
        user.username.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)) &&
      (active === null || String(user.is_active) === active) &&
      (username === null || user.username === username)
  );
  return HttpResponse.json(
    listDocument(request.url, matching.map(adminUserResource))
  );
}

// A user's data, read-only, as the admin API renders it: the same pages as
// the owner-only lists (the sync's keyset reads, and the newest junction).

function listAdminUserTags({params, request}: RouteInfo) {
  const owner = adminDataOf(String(params['id']));
  const url = new URL(request.url);
  const rows = owner.tags.filter(tag => changedSince(url, tag));
  return collectionResponse(url, owner, 'tags', rows, () =>
    listDocument(request.url, rows)
  );
}

function listAdminUserEntries({params, request}: RouteInfo) {
  const owner = adminDataOf(String(params['id']));
  const url = new URL(request.url);
  const rows = owner.state.data.filter(entry => changedSince(url, entry));
  return collectionResponse(url, owner, 'entries', rows, () =>
    listDocument(request.url, rows)
  );
}

function listAdminUserJunctions({params, request}: RouteInfo) {
  const owner = adminDataOf(String(params['id']));
  const url = new URL(request.url);
  const tagId = url.searchParams.get('filter[tag.id]');
  const rows = [...junctionsOf(owner.state), ...owner.deleted].filter(
    junction =>
      changedSince(url, junction) &&
      (tagId === null || junction.relationships.tag.data.id === tagId)
  );
  // The first page, whichever is asked for.
  return collectionResponse(url, owner, 'tags_entries', rows, () =>
    revisionPage(url, rows, 1)
  );
}

/**
 * What `changes` makes of `user`, as the API decides it (marking deactivates
 * too), or the API's 400 for what it refuses: reactivating a marked account,
 * and staff marking or deactivating themselves.
 */
function adminUserChange(
  user: MockAdminUser,
  changes: AdminUserUpdateAttributes
) {
  const wasMarked = user.date_marked_for_deletion !== null;
  const marked = changes.marked_for_deletion ?? wasMarked;
  if (marked && changes.is_active === true) {
    throw apiError(
      400,
      CODES.invalid,
      'An account marked for deletion cannot be reactivated.',
      '/data/attributes/is_active'
    );
  }
  const active = marked ? false : (changes.is_active ?? user.is_active);
  const marking = marked && !wasMarked;
  const self = user.username === SIGNED_IN_USER;
  if (self && marking) {
    throw apiError(
      400,
      CODES.invalid,
      'You cannot mark your own account for deletion.',
      '/data/attributes/marked_for_deletion'
    );
  }
  if (self && !active && user.is_active) {
    throw apiError(
      400,
      CODES.invalid,
      'You cannot deactivate your own account.',
      '/data/attributes/is_active'
    );
  }
  return {wasMarked, marked, active, marking};
}

const recordAudit = (action: AdminAuditAction, target: string) =>
  adminAuditLog.unshift({
    id: String(adminAuditLog.length + 1),
    created: '2026-09-28T12:00:00.000000',
    action,
    target,
  });

/**
 * Deactivate, reactivate, or (un)mark for deletion, as the API does, with
 * an audit log entry for each change (marking's deactivation is not one).
 */
async function patchAdminUser({params, request}: RouteInfo) {
  const user = findOr404(adminUsers, String(params['id']), 'AdminUser');
  const {attributes} = await parseResource(request, {
    type: 'AdminUser',
    id: user.id,
  });
  const {wasMarked, marked, active, marking} = adminUserChange(
    user,
    validateFields(adminUserUpdateAttributesSchema, attributes)
  );
  if (marked !== wasMarked) {
    recordAudit(
      marked ? 'mark_user_for_deletion' : 'unmark_user_for_deletion',
      user.username
    );
  }
  if (active !== user.is_active && !marking) {
    recordAudit(active ? 'activate_user' : 'deactivate_user', user.username);
  }
  user.is_active = active;
  user.date_marked_for_deletion = marked
    ? (user.date_marked_for_deletion ?? '2026-09-28T12:00:00.000000')
    : null;
  return HttpResponse.json({data: adminUserResource(user)});
}

const listAuditLog = ({request}: RouteInfo) =>
  HttpResponse.json(
    listDocument(request.url, adminAuditLog.map(adminAuditLogResource))
  );

export const adminRoutes = (baseUrl: string) => [
  route('GET', `${baseUrl}/admin/users`, listAdminUsers),
  route('GET', `${baseUrl}/admin/users/:id/tags`, listAdminUserTags),
  route('GET', `${baseUrl}/admin/users/:id/entries`, listAdminUserEntries),
  route(
    'GET',
    `${baseUrl}/admin/users/:id/tags_entries`,
    listAdminUserJunctions
  ),
  route('PATCH', `${baseUrl}/admin/users/:id`, patchAdminUser),
  route('GET', `${baseUrl}/admin/audit_log`, listAuditLog),
];
