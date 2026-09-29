/**
 * The staff-only admin API (backend-v2 `src/resources/admin.ts`), whose
 * responses are parsed with api-shared's admin document schemas.
 *
 * It calls `fetch` rather than `fetchWithAuth`, so the admin page can tell a
 * user who is not staff from one whose session is gone, but it signs out by
 * the same rule (`isSignedOutResponse`):
 * - 403 `permission_denied` (signed in, but not staff) keeps the session and
 *   raises AdminForbiddenError, so the page can say so.
 * - 403 `not_authenticated`, or a 403 with no code, signs out
 *   (`handleUnauthorized`) and raises AdminApiError.
 * - A write names the signed-in user (`EXPECTED_USER_HEADER`); a 409
 *   `user_mismatch` (the session is another user's) raises
 *   UserMismatchError, and the page leaves the session.
 * - Any other error, `origin_not_allowed` included, keeps the session and
 *   raises AdminApiError.
 *
 * `getStaffStatus` raises AdminSignedOutError on the 401 that `/user` answers
 * once the session has expired (or on a 403), and the page signs out.
 *
 * An OK response that does not fit its document schema raises AdminApiError
 * with status 0 (`Invalid admin API response: ...`), and keeps the session.
 */
import {
  CODES,
  EXPECTED_USER_HEADER,
} from '@commandsnippets/api-shared/messages';
import type {
  AdminAuditLogListParams,
  AdminUserListParams,
  AdminUserSortField,
  AdminUserUpdateDocument,
} from '@commandsnippets/api-shared/requests';
import {
  type AdminAuditAction,
  type AdminAuditLogEntry,
  type AdminUser as AdminUserResource,
  adminAuditLogListDocumentSchema,
  adminUserDocumentSchema,
  adminUserListDocumentSchema,
  userDocumentSchema,
} from '@commandsnippets/api-shared/responses';
import type * as z from 'zod/mini';
import {handleUnauthorized, signedInUser} from '../auth/authUtils';
import {UserMismatchError} from './apiClient';
import {baseURL} from './baseUrl';
import {firstError} from './errorDocument';
import {isSignedOutResponse} from './fetchWithAuth';
import {describeIssues} from './parseResponse';
import {toSearchParams} from './searchParams';

export type {AdminUserSortField};

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  isStaff: boolean;
  isActive: boolean;
  dateJoined: string;
  lastLogin: string | null;
  lastActive: string | null;
  loginCount: number;
  entryCount: number;
  tagCount: number;
}

export interface AdminAuditEntry {
  id: string;
  created: string;
  action: AdminAuditAction;
  actorUsername: string;
  targetUsername: string;
}

export interface AdminPage<T> {
  items: T[];
  page: number;
  pages: number;
  count: number;
}

export type AdminUserStatus = 'all' | 'active' | 'inactive';

export interface AdminUsersQuery {
  search: string;
  status: AdminUserStatus;
  sort: AdminUserSortField;
  descending: boolean;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export class AdminForbiddenError extends Error {
  constructor() {
    super('The admin API is for staff only.');
    this.name = 'AdminForbiddenError';
  }
}

/** The session is gone (401 or 403 from `/user`): the user must sign in. */
export class AdminSignedOutError extends Error {
  constructor() {
    super('Not signed in.');
    this.name = 'AdminSignedOutError';
  }
}

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

/**
 * An OK response's body parsed with its endpoint's document schema, or
 * AdminApiError (status 0) saying where it does not fit.
 */
function parse<S extends z.ZodMiniType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AdminApiError(
      0,
      `Invalid admin API response: ${describeIssues(result.error.issues)}`
    );
  }
  return result.data;
}

function toUser({id, attributes}: AdminUserResource): AdminUser {
  return {
    id,
    username: attributes.username,
    email: attributes.email,
    isStaff: attributes.is_staff,
    isActive: attributes.is_active,
    dateJoined: attributes.date_joined,
    lastLogin: attributes.last_login,
    lastActive: attributes.last_active,
    loginCount: attributes.login_count,
    entryCount: attributes.entry_count,
    tagCount: attributes.tag_count,
  };
}

function toAuditEntry({id, attributes}: AdminAuditLogEntry): AdminAuditEntry {
  return {
    id,
    created: attributes.created,
    action: attributes.action,
    actorUsername: attributes.actor_username,
    targetUsername: attributes.target_username,
  };
}

interface ListDocument<R> {
  data: R[];
  meta: {pagination: {page: number; pages: number; count: number}};
}

/** A page of a list document, with its resources mapped by `toItem`. */
function toPage<R, T>(
  {data, meta}: ListDocument<R>,
  toItem: (resource: R) => T
): AdminPage<T> {
  const {page, pages, count} = meta.pagination;
  return {items: data.map(toItem), page, pages, count};
}

async function adminFetch(
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const user = signedInUser();
  // A write names the signed-in user, as every write does (`apiClient`).
  const named = (init.method ?? 'GET') !== 'GET' ? user : null;
  const response = await fetch(`${baseURL}/admin${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      ...(named === null
        ? {}
        : {[EXPECTED_USER_HEADER]: encodeURIComponent(named)}),
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    return body;
  }
  const {code, detail} = firstError(body);
  if (named !== null && code === CODES.userMismatch) {
    throw new UserMismatchError('Admin request failed', named);
  }
  if (response.status === 403 && code === CODES.permissionDenied) {
    throw new AdminForbiddenError();
  }
  // The same sign-out rule as every other API call (fetchWithAuth).
  if (isSignedOutResponse(response.status, code)) {
    handleUnauthorized(user);
  }
  throw new AdminApiError(response.status, detail ?? response.statusText);
}

/**
 * Whether the signed-in user is staff, straight from the API: the stored flag
 * can be stale. `/user` answers 401 when the session has expired; that (or a
 * 403) raises AdminSignedOutError and leaves signing out to the page, where
 * `fetchWithAuth` would sign out from under it.
 */
export async function getStaffStatus(): Promise<boolean> {
  const response = await fetch(`${baseURL}/user/`, {
    credentials: 'include',
    headers: {'Content-Type': 'application/vnd.api+json'},
  });
  if (response.status === 401 || response.status === 403) {
    throw new AdminSignedOutError();
  }
  if (!response.ok) {
    throw new AdminApiError(response.status, response.statusText);
  }
  const body: unknown = await response.json().catch(() => null);
  return parse(userDocumentSchema, body).data.attributes.is_staff;
}

export async function listUsers(
  query: AdminUsersQuery,
  signal?: AbortSignal
): Promise<AdminPage<AdminUser>> {
  const search = query.search.trim();
  const params: AdminUserListParams = {
    'page[number]': query.page,
    'page[size]': query.pageSize,
    sort: query.descending ? `-${query.sort}` : query.sort,
    ...(search === '' ? {} : {'filter[search]': search}),
    ...(query.status === 'all'
      ? {}
      : {'filter[is_active]': query.status === 'active'}),
  };
  const init: RequestInit = signal === undefined ? {} : {signal};
  const body = await adminFetch(`/users?${toSearchParams(params)}`, init);
  return toPage(parse(adminUserListDocumentSchema, body), toUser);
}

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<AdminUser> {
  const document: AdminUserUpdateDocument = {
    data: {type: 'AdminUser', id, attributes: {is_active: isActive}},
  };
  const body = await adminFetch(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(document),
  });
  return toUser(parse(adminUserDocumentSchema, body).data);
}

export async function listAuditLog(
  page: number,
  pageSize: number,
  signal?: AbortSignal
): Promise<AdminPage<AdminAuditEntry>> {
  const params: AdminAuditLogListParams = {
    'page[number]': page,
    'page[size]': pageSize,
  };
  const init: RequestInit = signal === undefined ? {} : {signal};
  const body = await adminFetch(`/audit_log?${toSearchParams(params)}`, init);
  return toPage(parse(adminAuditLogListDocumentSchema, body), toAuditEntry);
}
