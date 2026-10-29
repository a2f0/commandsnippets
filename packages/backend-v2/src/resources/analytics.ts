import {
  type AnalyticsDocument,
  analyticsSearchQuerySchema,
} from '@commandsnippets/api-shared';
import {sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import type {AppEnv} from '../env';
import {parseOrThrow} from '../lib/validate';
import {versionOf} from './dataVersions';

export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.get('/', async c => {
  const user = requireUser(c);
  const version = versionOf(c, user);
  const query = parseOrThrow(analyticsSearchQuerySchema, [
    ...new URL(c.req.url).searchParams,
  ]);
  const {activity, interval, from, to, tag} = query;
  const tagFilter = tag === undefined ? sql`1` : sql`tag_id = ${tag}`;
  const entryFilter =
    tag === undefined
      ? sql`1`
      : sql`EXISTS (
    SELECT 1 FROM links WHERE links.entry_id = e.id AND links.tag_id = ${tag}
  )`;
  const source = {
    created: sql`SELECT e.date_created AS at, e.id AS entry_id, NULL AS tag_id
      FROM live_entries e WHERE ${entryFilter}`,
    tags_created: sql`SELECT date_created AS at, NULL AS entry_id, id AS tag_id
      FROM live_tags WHERE ${tag === undefined ? sql`1` : sql`id = ${tag}`}`,
    tagged: sql`SELECT date_created AS at, entry_id, tag_id FROM links WHERE ${tagFilter}`,
    reused: sql`SELECT r.date_created AS at, e.id AS entry_id, NULL AS tag_id
      FROM text_entries_textentryreused r JOIN live_entries e ON e.id = r.text_entry_id
      WHERE r.user_id = ${user.id} AND r.version = ${version} AND ${entryFilter}`,
  }[activity];
  const bucket = {
    day: sql`substr(at, 1, 10)`,
    week: sql`date(substr(at, 1, 10), '-' || ((CAST(strftime('%w', substr(at, 1, 10)) AS INTEGER) + 6) % 7) || ' days')`,
    month: sql`substr(at, 1, 7) || '-01'`,
  }[interval];
  // One statement gives all charts the same database snapshot. Events are
  // counted before tag attribution, so a multi-tagged entry is counted once.
  const rows = await c.get('db').all<{
    kind: string;
    id: string;
    name: string;
    count: number;
    entries: number | null;
    tags: number | null;
  }>(sql`WITH
    live_entries AS (
      SELECT id, subject, date_created FROM text_entries_textentry
      WHERE user_id = ${user.id} AND version = ${version} AND is_deleted = 0
    ),
    live_tags AS (
      SELECT id, name, date_created FROM tags_tag
      WHERE user_id = ${user.id} AND version = ${version} AND is_deleted = 0
    ),
    links AS (
      SELECT j.text_entry_id AS entry_id, j.tag_id, j.date_created
      FROM tags_tagtextentrythroughmodel j
      JOIN live_entries e ON e.id = j.text_entry_id JOIN live_tags t ON t.id = j.tag_id
      WHERE j.user_id = ${user.id} AND j.version = ${version} AND j.is_deleted = 0
    ),
    source AS (${source}),
    events AS (SELECT * FROM source WHERE at >= ${`${from}T00:00:00`}
      AND at <= ${`${to}T23:59:59.999999`}),
    tag_events AS (${
      activity === 'created' || activity === 'reused'
        ? sql`SELECT l.tag_id FROM events e JOIN links l ON l.entry_id = e.entry_id`
        : sql`SELECT tag_id FROM events`
    }),
    ranked_tags AS (
      SELECT CAST(t.id AS TEXT) AS id, t.name, COUNT(*) AS count
      FROM tag_events a JOIN live_tags t ON t.id = a.tag_id
      GROUP BY t.id ORDER BY count DESC, t.name, t.id LIMIT 10
    ),
    ranked_entries AS (
      SELECT CAST(e.id AS TEXT) AS id, e.subject AS name, COUNT(*) AS count
      FROM events a JOIN live_entries e ON e.id = a.entry_id
      GROUP BY e.id ORDER BY count DESC, e.subject, e.id LIMIT 10
    )
    SELECT 'total' AS kind, '' AS id, '' AS name, COUNT(*) AS count,
      COUNT(DISTINCT entry_id) AS entries, (SELECT COUNT(DISTINCT tag_id) FROM tag_events) AS tags FROM events
    UNION ALL SELECT 'timeline', '', ${bucket}, COUNT(*), NULL, NULL FROM events GROUP BY ${bucket}
    UNION ALL SELECT 'tag', id, name, count, NULL, NULL FROM ranked_tags
    UNION ALL SELECT 'entry', id, name, count, NULL, NULL FROM ranked_entries
    ORDER BY kind, count DESC, name, id
  `);
  const summary = rows.find(row => row.kind === 'total');
  const ranking = (kind: string) =>
    rows
      .filter(row => row.kind === kind)
      .map(({id, name, count}) => ({id, name, count}));
  const document: AnalyticsDocument = {
    data: {
      version,
      activity,
      interval,
      from,
      to,
      total: summary?.count ?? 0,
      entries: summary?.entries ?? 0,
      tags: summary?.tags ?? 0,
      timeline: rows
        .filter(row => row.kind === 'timeline')
        .map(row => ({date: row.name, count: row.count}))
        .sort((a, b) => a.date.localeCompare(b.date)),
      top_tags: ranking('tag'),
      top_entries: ranking('entry'),
    },
  };
  c.header('Cache-Control', 'private, no-store');
  return c.json(document);
});
