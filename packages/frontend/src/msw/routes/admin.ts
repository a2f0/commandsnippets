/** The admin API: users, their data (read-only), and the audit log. */
import {
  type AdminAuditAction,
  type AdminAuditLogEntry,
  type AdminUser,
  adminUserUpdateAttributesSchema,
  CODES,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {onePage} from '../documents';
import type {MockAdminUser, MockAuditEntry} from '../fixtures';
import {
  adminDataOf,
  changedSince,
  collectionResponse,
  revisionPage,
} from '../reads';
import {apiError, parseResource, validateFields} from '../requests';
import {route, SIGNED_IN_USER} from '../route';
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

/** A one-page list document of `data`, for the request to `url`. */
export const listDocument = <T>(url: string, data: T[]) => ({
  ...onePage(url, data.length),
  data,
});

export const adminRoutes = (baseUrl: string) => [
  // Admin API
  route('GET', `${baseUrl}/admin/users`, ({request}) => {
    const params = new URL(request.url).searchParams;
    const search = params.get('filter[search]')?.toLowerCase();
    const active = params.get('filter[is_active]');
    const username = params.get('filter[username]');
    const matching = adminUsers.filter(
      user =>
        (search === undefined ||
          user.username.includes(search) ||
          user.email.includes(search)) &&
        (active === null || String(user.is_active) === active) &&
        (username === null || user.username === username)
    );
    return HttpResponse.json(
      listDocument(request.url, matching.map(adminUserResource))
    );
  }),
  // A user's data, read-only, as the admin API renders it: the same
  // pages as the owner-only lists (the sync's keyset reads, and the
  // newest junction).
  route('GET', `${baseUrl}/admin/users/:id/tags`, ({params, request}) => {
    const owner = adminDataOf(String(params['id']));
    const url = new URL(request.url);
    const rows = owner.tags.filter(tag => changedSince(url, tag));
    return collectionResponse(url, owner, 'tags', rows, () =>
      listDocument(request.url, rows)
    );
  }),
  route('GET', `${baseUrl}/admin/users/:id/entries`, ({params, request}) => {
    const owner = adminDataOf(String(params['id']));
    const url = new URL(request.url);
    const rows = owner.state.data.filter(entry => changedSince(url, entry));
    return collectionResponse(url, owner, 'entries', rows, () =>
      listDocument(request.url, rows)
    );
  }),
  route(
    'GET',
    `${baseUrl}/admin/users/:id/tags_entries`,
    ({params, request}) => {
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
  ),
  // Deactivate, reactivate, or (un)mark for deletion, as the API does
  // (marking deactivates too); staff cannot do either to themselves.
  route('PATCH', `${baseUrl}/admin/users/:id`, async ({params, request}) => {
    const user = findOr404(adminUsers, String(params['id']), 'AdminUser');
    const {attributes} = await parseResource(request, {
      type: 'AdminUser',
      id: user.id,
    });
    const changes = validateFields(adminUserUpdateAttributesSchema, attributes);
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
    if (user.username === SIGNED_IN_USER && marking) {
      throw apiError(
        400,
        CODES.invalid,
        'You cannot mark your own account for deletion.',
        '/data/attributes/marked_for_deletion'
      );
    }
    if (user.username === SIGNED_IN_USER && !active && user.is_active) {
      throw apiError(
        400,
        CODES.invalid,
        'You cannot deactivate your own account.',
        '/data/attributes/is_active'
      );
    }
    const record = (action: AdminAuditAction) =>
      adminAuditLog.unshift({
        id: String(adminAuditLog.length + 1),
        created: '2026-09-28T12:00:00.000000',
        action,
        target: user.username,
      });
    if (marked !== wasMarked) {
      record(marked ? 'mark_user_for_deletion' : 'unmark_user_for_deletion');
    }
    if (active !== user.is_active && !marking) {
      record(active ? 'activate_user' : 'deactivate_user');
    }
    user.is_active = active;
    user.date_marked_for_deletion = marked
      ? (user.date_marked_for_deletion ?? '2026-09-28T12:00:00.000000')
      : null;
    return HttpResponse.json({data: adminUserResource(user)});
  }),
  route('GET', `${baseUrl}/admin/audit_log`, ({request}) =>
    HttpResponse.json(
      listDocument(request.url, adminAuditLog.map(adminAuditLogResource))
    )
  ),
];
