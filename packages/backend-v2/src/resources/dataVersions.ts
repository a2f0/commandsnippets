/**
 * Data versions (`users_dataversion`): every tag, entry, tagging and reuse
 * belongs to one of its user's versions, and their reads and writes are of
 * the active one (`users_user.active_version`). Version 1 is the data an
 * account starts with; a restore (`restore.ts`) makes the next and makes it
 * active, keeping the one before as it was. A version that is not active
 * never changes (the triggers of `0019_data_versions.sql` refuse it in the
 * statement that writes), so a client's copy of one stays right however
 * long it waited, and a write queued against it is refused once another is
 * active. Numbers are never reused (`users_user.last_version`).
 *
 * - `GET /api/v1/user/data_versions`: every version, newest first.
 * - `POST /api/v1/user/data_versions/:version/activate`: make it active.
 * - `DELETE /api/v1/user/data_versions/:version`: delete one not active,
 *   rows and all.
 */
import {
  DATA_VERSION,
  DATA_VERSION_HEADER,
  type DataVersionAttributes,
} from '@commandsnippets/api-shared';
import {and, desc, eq, getTableColumns, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
import {
  type DataVersionRow,
  dataVersions,
  entryReuses,
  tags,
  tagsEntries,
  textEntries,
  type User,
  users,
} from '../db/schema';
import type {AppEnv} from '../env';
import {isoformat} from '../lib/clock';
import {dataVersionChanged, notFound, validationError} from '../lib/errors';
import {document} from '../lib/jsonapi';
import {jsonApi} from './responses';

/**
 * The data version a request reads or writes `owner`'s data at: the one it
 * names (`DATA_VERSION_HEADER`), which must be their active one (409
 * `data_version_changed` otherwise: the client's copy is of another). A
 * read that names none is of the active one; a write must name the one it
 * was made against (400 otherwise), so none made before a restore or a
 * switch lands in the version made active.
 */
export function versionOf(c: Context<AppEnv>, owner: User): number {
  const header = c.req.header(DATA_VERSION_HEADER);
  if (header === undefined) {
    if (c.req.method === 'GET' || c.req.method === 'HEAD') {
      return owner.active_version;
    }
    throw validationError(
      `${DATA_VERSION_HEADER} must name the data version a write was made against.`
    );
  }
  if (!/^[1-9]\d*$/.test(header)) {
    throw validationError(`${DATA_VERSION_HEADER} must be a version number.`);
  }
  if (Number(header) !== owner.active_version) {
    throw dataVersionChanged();
  }
  return owner.active_version;
}

/**
 * The live (not deleted) rows of `table` in each listed version. Written out
 * with table names: drizzle leaves columns unqualified in a single-table
 * select, so `${dataVersions.user_id}` in here would bind to the counted
 * table's own `user_id`.
 */
const liveCount = (table: 'tags_tag' | 'text_entries_textentry') =>
  sql<number>`(SELECT COUNT(*) FROM ${sql.identifier(table)} AS r WHERE r.user_id = users_dataversion.user_id AND r.version = users_dataversion.version AND r.is_deleted = 0)`;

type VersionRow = DataVersionRow & {tag_count: number; entry_count: number};

const versionFields = {
  ...getTableColumns(dataVersions),
  tag_count: liveCount('tags_tag'),
  entry_count: liveCount('text_entries_textentry'),
};

function versionResource(row: VersionRow, active: number) {
  const attributes: DataVersionAttributes = {
    version: row.version,
    date_created: isoformat(row.date_created),
    active: row.version === active,
    origin: row.origin === 'restore' ? 'restore' : 'initial',
    backup_username: row.backup_username,
    backup_exported: isoformat(row.backup_exported),
    tag_count: row.tag_count,
    entry_count: row.entry_count,
  };
  return {type: DATA_VERSION, id: String(row.version), attributes};
}

/** `userId`'s version `version`, with its counts, if they have it. */
export async function findVersion(
  db: Db,
  userId: number,
  version: number
): Promise<VersionRow | undefined> {
  const [row] = await db
    .select(versionFields)
    .from(dataVersions)
    .where(
      and(eq(dataVersions.user_id, userId), eq(dataVersions.version, version))
    )
    .limit(1);
  return row;
}

/** The `:version` route parameter: one of the user's versions, else a 404. */
async function routeVersion(
  c: Context<AppEnv>,
  user: User
): Promise<VersionRow> {
  const param = c.req.param('version') ?? '';
  const row = /^[1-9]\d*$/.test(param)
    ? await findVersion(c.get('db'), user.id, Number(param))
    : undefined;
  if (row === undefined) {
    throw notFound(`No ${DATA_VERSION} matches the given query.`);
  }
  return row;
}

/** The user's active version now (it may have changed since they were read). */
async function activeVersion(db: Db, userId: number): Promise<number> {
  const [row] = await db
    .select({active: users.active_version})
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.active ?? 1;
}

export const dataVersionRoutes = new Hono<AppEnv>();

dataVersionRoutes.get('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const rows = await db
    .select(versionFields)
    .from(dataVersions)
    .where(eq(dataVersions.user_id, user.id))
    .orderBy(desc(dataVersions.version));
  const active = await activeVersion(db, user.id);
  const body = {data: rows.map(row => versionResource(row, active))};
  return c.body(JSON.stringify(body), 200, {
    'Content-Type': 'application/vnd.api+json',
    'Cache-Control': 'no-store',
  });
});

/**
 * Make a version active. Every client's copy of the data is then of another
 * and syncs again; the public view does too (`public_revision`).
 */
dataVersionRoutes.post('/:version/activate', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const row = await routeVersion(c, user);
  const {version} = row;
  try {
    await db
      .update(users)
      .set({
        active_version: version,
        public_revision: sql`${users.public_revision} + CASE WHEN ${users.active_version} = ${version} THEN 0 ELSE 1 END`,
      })
      .where(eq(users.id, user.id));
  } catch (error) {
    // Deleted since it was read (by another request).
    if (
      String((error as {cause?: Error})?.cause?.message ?? error).includes(
        'data_version_missing:'
      )
    ) {
      throw notFound(`No ${DATA_VERSION} matches the given query.`);
    }
    throw error;
  }
  // Its rows are as they were read: making it active changes none.
  return jsonApi(c, document(versionResource(row, version), []));
});

/**
 * Delete a version that is not active, rows and all. Its users_dataversion
 * row goes first, so its rows (which nothing writes while it is not active)
 * may change and go: their deletes' counter triggers write them. Each delete
 * names that the row is gone, so none happens if the version was made
 * active meanwhile.
 */
dataVersionRoutes.delete('/:version', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {version} = await routeVersion(c, user);
  const notActive = () =>
    validationError('The active data version cannot be deleted.');
  if (version === (await activeVersion(db, user.id))) {
    throw notActive();
  }
  const gone = sql`NOT EXISTS (SELECT 1 FROM ${dataVersions} WHERE ${dataVersions.user_id} = ${user.id} AND ${dataVersions.version} = ${version})`;
  const ofVersion = (
    table:
      | typeof tags
      | typeof textEntries
      | typeof tagsEntries
      | typeof entryReuses
  ) => and(eq(table.user_id, user.id), eq(table.version, version), gone);
  const [deleted] = await db.batch([
    db
      .delete(dataVersions)
      .where(
        and(
          eq(dataVersions.user_id, user.id),
          eq(dataVersions.version, version),
          sql`${dataVersions.version} <> (SELECT ${users.active_version} FROM ${users} WHERE ${users.id} = ${user.id})`
        )
      )
      .returning({version: dataVersions.version}),
    db.delete(tagsEntries).where(ofVersion(tagsEntries)),
    db.delete(entryReuses).where(ofVersion(entryReuses)),
    db.delete(textEntries).where(ofVersion(textEntries)),
    db.delete(tags).where(ofVersion(tags)),
  ]);
  if (deleted.length === 0) {
    throw notActive();
  }
  return c.body(null, 204);
});
