/**
 * The staff-only admin API (backend-v2 `src/resources/admin.ts`).
 *
 * Unlike `fetchWithAuth`, a 403 only logs the user out when it means they
 * are not signed in. `permission_denied` (signed in, but not staff) raises
 * AdminForbiddenError instead, so the page can say so.
 */
import {handleUnauthorized} from '../auth/authUtils';
import {baseURL} from './baseUrl';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  isStaff: boolean;
  isActive: boolean;
  dateJoined: string;
  lastLogin: string | null;
  loginCount: number;
  entryCount: number;
  tagCount: number;
}

export interface AdminAuditEntry {
  id: string;
  created: string;
  action: string;
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

export type AdminUserSortField =
  | 'username'
  | 'email'
  | 'date_joined'
  | 'last_login'
  | 'login_count'
  | 'entry_count'
  | 'tag_count';

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

type Guard<T> = (value: unknown) => value is T;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString: Guard<string> = value => typeof value === 'string';
const isNumber: Guard<number> = value => typeof value === 'number';
const isBoolean: Guard<boolean> = value => typeof value === 'boolean';
const isNullableString: Guard<string | null> = value =>
  value === null || typeof value === 'string';

function invalid(what: string): AdminApiError {
  return new AdminApiError(0, `Invalid admin API response: ${what}`);
}

function field<T>(
  record: Record<string, unknown>,
  key: string,
  guard: Guard<T>
): T {
  const value = record[key];
  if (!guard(value)) {
    throw invalid(key);
  }
  return value;
}

function attributesOf(resource: unknown, type: string) {
  if (
    !isRecord(resource) ||
    resource['type'] !== type ||
    !isString(resource['id']) ||
    !isRecord(resource['attributes'])
  ) {
    throw invalid(type);
  }
  return {id: resource['id'], attributes: resource['attributes']};
}

function parseUser(resource: unknown): AdminUser {
  const {id, attributes} = attributesOf(resource, 'AdminUser');
  return {
    id,
    username: field(attributes, 'username', isString),
    email: field(attributes, 'email', isString),
    isStaff: field(attributes, 'is_staff', isBoolean),
    isActive: field(attributes, 'is_active', isBoolean),
    dateJoined: field(attributes, 'date_joined', isString),
    lastLogin: field(attributes, 'last_login', isNullableString),
    loginCount: field(attributes, 'login_count', isNumber),
    entryCount: field(attributes, 'entry_count', isNumber),
    tagCount: field(attributes, 'tag_count', isNumber),
  };
}

function parseAuditEntry(resource: unknown): AdminAuditEntry {
  const {id, attributes} = attributesOf(resource, 'AdminAuditLogEntry');
  return {
    id,
    created: field(attributes, 'created', isString),
    action: field(attributes, 'action', isString),
    actorUsername: field(attributes, 'actor_username', isString),
    targetUsername: field(attributes, 'target_username', isString),
  };
}

function parsePage<T>(
  body: unknown,
  parse: (item: unknown) => T
): AdminPage<T> {
  if (!isRecord(body) || !Array.isArray(body['data'])) {
    throw invalid('data');
  }
  const meta = body['meta'];
  const pagination = isRecord(meta) ? meta['pagination'] : undefined;
  if (!isRecord(pagination)) {
    throw invalid('meta.pagination');
  }
  return {
    items: body['data'].map(parse),
    page: field(pagination, 'page', isNumber),
    pages: field(pagination, 'pages', isNumber),
    count: field(pagination, 'count', isNumber),
  };
}

function firstError(body: unknown): Record<string, unknown> | undefined {
  if (!isRecord(body) || !Array.isArray(body['errors'])) {
    return undefined;
  }
  const [error] = body['errors'];
  return isRecord(error) ? error : undefined;
}

async function adminFetch(
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const response = await fetch(`${baseURL}/admin${path}`, {
    ...init,
    credentials: 'include',
    headers: {'Content-Type': 'application/vnd.api+json'},
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    return body;
  }
  const error = firstError(body);
  if (response.status === 403) {
    if (error?.['code'] === 'permission_denied') {
      throw new AdminForbiddenError();
    }
    handleUnauthorized();
  }
  const detail = error?.['detail'];
  throw new AdminApiError(
    response.status,
    isString(detail) ? detail : response.statusText
  );
}

/**
 * Whether the signed-in user is staff, straight from the API: the stored flag
 * can be stale. `/user` answers 401 when the session has expired, which
 * `fetchWithAuth` (403 only) would not treat as signed out.
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
  const body: unknown = await response.json();
  const data = isRecord(body) ? body['data'] : undefined;
  const attributes = isRecord(data) ? data['attributes'] : undefined;
  if (!isRecord(attributes)) {
    throw invalid('user');
  }
  return attributes['is_staff'] === true;
}

export async function listUsers(
  query: AdminUsersQuery,
  signal?: AbortSignal
): Promise<AdminPage<AdminUser>> {
  const params = new URLSearchParams({
    'page[number]': String(query.page),
    'page[size]': String(query.pageSize),
    sort: `${query.descending ? '-' : ''}${query.sort}`,
  });
  if (query.search.trim() !== '') {
    params.set('filter[search]', query.search.trim());
  }
  if (query.status !== 'all') {
    params.set('filter[is_active]', String(query.status === 'active'));
  }
  const init: RequestInit = signal === undefined ? {} : {signal};
  return parsePage(await adminFetch(`/users?${params}`, init), parseUser);
}

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<AdminUser> {
  const body = await adminFetch(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {type: 'AdminUser', id, attributes: {is_active: isActive}},
    }),
  });
  if (!isRecord(body)) {
    throw invalid('body');
  }
  return parseUser(body['data']);
}

export async function listAuditLog(
  page: number,
  pageSize: number,
  signal?: AbortSignal
): Promise<AdminPage<AdminAuditEntry>> {
  const params = new URLSearchParams({
    'page[number]': String(page),
    'page[size]': String(pageSize),
  });
  const init: RequestInit = signal === undefined ? {} : {signal};
  return parsePage(
    await adminFetch(`/audit_log?${params}`, init),
    parseAuditEntry
  );
}
