#!/usr/bin/env bun
/**
 * Convert a Django-era Postgres backup (`pg_dump -Fc`) into a SQL file for
 * D1, then verify it by loading it into an in-memory SQLite database built from
 * this project's migrations.
 *
 *   bun scripts/import-postgres.ts <backup-pg_dump-Fc> [--out data/import.sql]
 *
 * No Postgres server is needed: `pg_restore -a -f -` turns the archive into
 * SQL, and the `COPY ... FROM stdin` blocks are parsed directly. Set
 * PG_RESTORE to use a different binary, e.g. one from a newer Postgres image:
 *
 *   PG_RESTORE="docker run --rm -i postgres:18 pg_restore" bun scripts/...
 *
 * The output contains user data and auth tokens: keep it out of git (data/ is
 * ignored) and delete it when done.
 */
import {Database} from 'bun:sqlite';
import {mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {now, parseDateTime} from '../src/lib/clock';
import {fold} from '../src/lib/search';
import RESERVED_USERNAMES from '../src/services/reserved-usernames.json';

export type Value = string | number | null;
export type Row = Record<string, string | null>;

export interface TableSpec {
  /** Columns to copy, in insert order. */
  columns: string[];
  booleans?: string[];
  integers?: string[];
  timestamps?: string[];
  /** Columns that exist only in D1, derived from the decoded dump row. */
  computed?: Record<string, (row: Row) => Value>;
}

/** Every column a converted row holds: copied ones, then computed ones. */
export function allColumns(spec: TableSpec): string[] {
  return [...spec.columns, ...Object.keys(spec.computed ?? {})];
}

/** Tables to import, in foreign-key order. Everything else is Django-internal. */
export const TABLES: Record<string, TableSpec> = {
  users_user: {
    // `password` is dropped (v2 has no password login), and so is
    // `is_superuser` (v2 has only is_staff).
    columns: [
      'id',
      'username',
      'email',
      'first_name',
      'last_name',
      'is_staff',
      'is_active',
      'last_login',
      'date_joined',
      'date_updated',
      'login_count',
    ],
    booleans: ['is_staff', 'is_active'],
    integers: ['id', 'login_count'],
    timestamps: ['last_login', 'date_joined', 'date_updated'],
  },
  authtoken_token: {
    columns: ['key', 'created', 'user_id'],
    integers: ['user_id'],
    timestamps: ['created'],
  },
  text_entries_textentry: {
    columns: [
      'id',
      'body',
      'subject',
      'date_created',
      'date_updated',
      'user_id',
      'is_deleted',
      'tag_count',
      'reused_count',
      'reused_date',
    ],
    booleans: ['is_deleted'],
    integers: ['id', 'user_id', 'tag_count', 'reused_count'],
    timestamps: ['date_created', 'date_updated', 'reused_date'],
    // Unicode folds for search, which SQL cannot compute (src/lib/search.ts).
    computed: {
      subject_folded: row => fold(row['subject'] ?? ''),
      body_folded: row => fold(row['body'] ?? ''),
    },
  },
  tags_tag: {
    columns: [
      'id',
      'name',
      'date_created',
      'date_updated',
      'user_id',
      'entry_count',
      'date_last_used',
      'order',
      'is_deleted',
    ],
    booleans: ['is_deleted'],
    integers: ['id', 'user_id', 'entry_count', 'order'],
    timestamps: ['date_created', 'date_updated', 'date_last_used'],
  },
  tags_tagtextentrythroughmodel: {
    columns: [
      'id',
      'order',
      'tag_id',
      'text_entry_id',
      'date_created',
      'date_updated',
      'user_id',
    ],
    integers: ['id', 'order', 'tag_id', 'text_entry_id', 'user_id'],
    timestamps: ['date_created', 'date_updated'],
  },
  text_entries_textentryreused: {
    columns: ['id', 'date_created', 'text_entry_id', 'user_id'],
    integers: ['id', 'text_entry_id', 'user_id'],
    timestamps: ['date_created'],
  },
};

const ROWS_PER_INSERT = 25;

/**
 * D1 rejects SQL statements over 100 KB. Rows are batched by UTF-8 size as
 * well as count, with headroom: 25 maximum-length non-ASCII entries would
 * otherwise come to ~130 KB.
 */
export const MAX_STATEMENT_BYTES = 90_000;

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

// ---------------------------------------------------------------------------
// Reading the archive
// ---------------------------------------------------------------------------

export async function restoreToSql(
  archive: string,
  pgRestore: string = process.env['PG_RESTORE'] ?? 'pg_restore'
): Promise<string> {
  const command = pgRestore.split(' ');
  const usesStdin = command.length > 1;
  const proc = Bun.spawn(
    [
      ...command,
      '--data-only',
      '--no-owner',
      '-f',
      '-',
      ...(usesStdin ? [] : [archive]),
    ],
    {
      stdin: usesStdin ? Bun.file(archive) : 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`pg_restore failed (${code}):\n${stderr}`);
  }
  return stdout;
}

/** Decode one field of Postgres COPY text format. */
export function decodeCopyField(field: string): string | null {
  if (field === '\\N') {
    return null;
  }
  return field.replace(
    /\\(?:([0-7]{1,3})|x([0-9a-fA-F]{1,2})|(.))/g,
    (_match, octal: string, hex: string, char: string) => {
      if (octal !== undefined) {
        return String.fromCharCode(Number.parseInt(octal, 8));
      }
      if (hex !== undefined) {
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      const escapes: Record<string, string> = {
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        v: '\v',
      };
      return escapes[char] ?? char;
    }
  );
}

export interface Dump {
  tables: Map<string, Row[]>;
  sequences: Map<string, number>;
}

export function parseDump(sql: string): Dump {
  const tables = new Map<string, Row[]>();
  const sequences = new Map<string, number>();
  const lines = sql.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const setval = /setval\('public\.(\w+)_id_seq', (\d+), (true|false)\)/.exec(
      line
    );
    if (setval) {
      const [, table, value, isCalled] = setval;
      // is_called=false means the next value is `value` itself.
      sequences.set(
        table as string,
        Number(value) - (isCalled === 'true' ? 0 : 1)
      );
      continue;
    }
    const copy = /^COPY public\.(\w+) \((.+)\) FROM stdin;$/.exec(line);
    if (!copy) {
      continue;
    }
    const [, table, columnList] = copy;
    const columns = (columnList as string)
      .split(', ')
      .map(column => column.replace(/^"|"$/g, ''));
    const rows: Row[] = [];
    for (i++; lines[i] !== '\\.'; i++) {
      if (i >= lines.length) {
        throw new Error(`Unterminated COPY block for ${table}`);
      }
      const fields = (lines[i] as string).split('\t');
      if (fields.length !== columns.length) {
        throw new Error(
          `${table}: expected ${columns.length} fields, got ${fields.length} on line ${i + 1}`
        );
      }
      rows.push(
        Object.fromEntries(
          columns.map((column, index) => [
            column,
            decodeCopyField(fields[index] as string),
          ])
        )
      );
    }
    tables.set(table as string, rows);
  }
  return {tables, sequences};
}

// ---------------------------------------------------------------------------
// Converting
// ---------------------------------------------------------------------------

export function convert(table: string, spec: TableSpec, row: Row): Value[] {
  const copied = spec.columns.map(column => {
    if (!(column in row)) {
      throw new Error(`${table}: column ${column} missing from dump`);
    }
    const value = row[column] as string | null;
    if (value === null) {
      return null;
    }
    if (spec.booleans?.includes(column)) {
      if (value !== 't' && value !== 'f') {
        throw new Error(`${table}.${column}: bad boolean ${value}`);
      }
      return value === 't' ? 1 : 0;
    }
    if (spec.integers?.includes(column)) {
      return Number(value);
    }
    if (spec.timestamps?.includes(column)) {
      const parsed = parseDateTime(value);
      if (parsed === null) {
        throw new Error(`${table}.${column}: bad timestamp ${value}`);
      }
      return parsed;
    }
    return value;
  });
  const computed = Object.values(spec.computed ?? {}).map(derive =>
    derive(row)
  );
  return [...copied, ...computed];
}

function literal(value: Value): string {
  if (value === null) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

const quote = (identifier: string) => `"${identifier}"`;

export interface Converted {
  table: string;
  spec: TableSpec;
  rows: Value[][];
}

/**
 * Django ranked every row in one global sequence, and new users' example rows
 * were created with hard-coded ranks, so some ordering scopes contain ties.
 * `above()` is a no-op for tied rows, so re-rank just those scopes densely
 * (current order, ties broken by id) and bump `date_updated` on rows whose
 * rank changed so clients re-sync them.
 */
export function normalizeRanks(
  found: Converted,
  scopeColumn: string,
  timestamp: string = now()
): Value[][] {
  const index = (column: string) => found.spec.columns.indexOf(column);
  const [id, order, scope, updated] = [
    'id',
    'order',
    scopeColumn,
    'date_updated',
  ].map(index) as number[];
  const scopes = new Map<Value, Value[][]>();
  for (const row of found.rows) {
    const key = row[scope as number] as Value;
    scopes.set(key, [...(scopes.get(key) ?? []), row]);
  }
  const changed: Value[][] = [];
  for (const rows of scopes.values()) {
    const ranks = rows.map(row => row[order as number]);
    if (new Set(ranks).size === ranks.length) {
      continue;
    }
    rows.sort(
      (a, b) =>
        (a[order as number] as number) - (b[order as number] as number) ||
        (a[id as number] as number) - (b[id as number] as number)
    );
    rows.forEach((row, rank) => {
      if (row[order as number] !== rank) {
        row[order as number] = rank;
        row[updated as number] = timestamp;
        changed.push(row);
      }
    });
  }
  return changed;
}

/**
 * The import as individual SQL statements, in order. Kept separate so a
 * verifier can run them one at a time: bun:sqlite silently skips a failing
 * statement in the middle of a multi-statement run.
 */
export function buildStatements(
  converted: Converted[],
  sequences: ReadonlyMap<string, number>
): string[] {
  const out: string[] = [];
  for (const {table, spec, rows} of converted) {
    const head = `INSERT INTO ${quote(table)} (${allColumns(spec).map(quote).join(', ')}) VALUES\n  `;
    let batch: string[] = [];
    let bytes = utf8Bytes(head);
    const flush = () => {
      if (batch.length > 0) {
        out.push(`${head}${batch.join(',\n  ')};`);
      }
      batch = [];
      bytes = utf8Bytes(head);
    };
    for (const row of rows) {
      const tuple = `(${row.map(literal).join(', ')})`;
      const size = utf8Bytes(tuple) + 4; // separator and terminator
      if (
        batch.length >= ROWS_PER_INSERT ||
        (batch.length > 0 && bytes + size > MAX_STATEMENT_BYTES)
      ) {
        flush();
      }
      batch.push(tuple);
      bytes += size;
    }
    flush();
  }

  // Inserting junctions and reuses fired the counter triggers on top of the
  // counters copied from Postgres; put the source values back.
  const restore = (table: string, columns: string[]) => {
    const found = converted.find(entry => entry.table === table);
    if (found === undefined) {
      return;
    }
    const index = (column: string) => found.spec.columns.indexOf(column);
    for (const row of found.rows) {
      const assignments = columns
        .map(
          column => `${quote(column)} = ${literal(row[index(column)] as Value)}`
        )
        .join(', ');
      out.push(
        `UPDATE ${quote(table)} SET ${assignments} WHERE id = ${row[index('id')]};`
      );
    }
  };
  restore('tags_tag', ['entry_count', 'date_last_used']);
  restore('text_entries_textentry', [
    'tag_count',
    'reused_count',
    'reused_date',
  ]);

  // Keep ids monotonic with Postgres so deleted ids are never reused. A table
  // that received no rows has no sqlite_sequence row yet, so insert one.
  for (const {table} of converted) {
    const value = sequences.get(table);
    if (value !== undefined) {
      out.push(
        `UPDATE sqlite_sequence SET seq = MAX(seq, ${value}) WHERE name = '${table}';`,
        `INSERT INTO sqlite_sequence (name, seq) SELECT '${table}', ${value} WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = '${table}');`
      );
    }
  }
  return out;
}

/** The import file for `wrangler d1 execute --file`. */
export function renderSql(statements: string[]): string {
  return `${[
    '-- Generated by scripts/import-postgres.ts. Contains user data: do not commit.',
    '-- Apply to an empty, migrated database.',
    ...statements,
  ].join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Verifying
// ---------------------------------------------------------------------------

export function loadMigrations(db: Database): void {
  const dir = path.join(import.meta.dirname, '..', 'migrations');
  for (const file of readdirSync(dir)
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const statement of text.split('--> statement-breakpoint')) {
      if (statement.trim() !== '') {
        db.run(statement);
      }
    }
  }
}

interface Check {
  name: string;
  sql: string;
  /** 'error' checks fail the import; 'warn' checks are reported. */
  level: 'error' | 'warn';
}

const CHECKS: Check[] = [
  {
    // The web app's own routes (src/services/users.ts); migrations rename
    // such accounts, but the import loads users after the migrations ran.
    name: 'usernames reserved for web app routes (rename them first)',
    sql: `SELECT id, username FROM users_user WHERE lower(username) IN (${RESERVED_USERNAMES.map(
      name => `'${name}'`
    ).join(', ')})`,
    level: 'error',
  },
  {
    name: 'foreign key violations',
    sql: 'PRAGMA foreign_key_check',
    level: 'error',
  },
  {
    name: 'tags whose entry_count disagrees with their junctions',
    sql: `SELECT t.id, t.entry_count, COUNT(j.id) AS actual FROM tags_tag t
          LEFT JOIN tags_tagtextentrythroughmodel j ON j.tag_id = t.id
          GROUP BY t.id HAVING t.entry_count != COUNT(j.id)`,
    level: 'warn',
  },
  {
    name: 'entries whose tag_count disagrees with their junctions',
    sql: `SELECT e.id, e.tag_count, COUNT(j.id) AS actual FROM text_entries_textentry e
          LEFT JOIN tags_tagtextentrythroughmodel j ON j.text_entry_id = e.id
          GROUP BY e.id HAVING e.tag_count != COUNT(j.id)`,
    level: 'warn',
  },
  {
    name: 'entries whose reused_count disagrees with their reuses',
    sql: `SELECT e.id, e.reused_count, COUNT(r.id) AS actual FROM text_entries_textentry e
          LEFT JOIN text_entries_textentryreused r ON r.text_entry_id = e.id
          GROUP BY e.id HAVING e.reused_count != COUNT(r.id)`,
    level: 'warn',
  },
  {
    name: 'duplicate tag ranks within a user (ordering scope)',
    sql: `SELECT user_id, "order", COUNT(*) AS n FROM tags_tag
          GROUP BY user_id, "order" HAVING n > 1`,
    level: 'error',
  },
  {
    name: 'duplicate junction ranks within a tag (ordering scope)',
    sql: `SELECT tag_id, "order", COUNT(*) AS n FROM tags_tagtextentrythroughmodel
          GROUP BY tag_id, "order" HAVING n > 1`,
    level: 'error',
  },
  {
    name: 'junctions owned by a different user than their tag or entry',
    sql: `SELECT j.id, j.user_id, t.user_id AS tag_user, e.user_id AS entry_user
          FROM tags_tagtextentrythroughmodel j
          JOIN tags_tag t ON t.id = j.tag_id
          JOIN text_entries_textentry e ON e.id = j.text_entry_id
          WHERE j.user_id != t.user_id OR j.user_id != e.user_id`,
    level: 'warn',
  },
  {
    // v2 never includes another user's rows, but Django did not check.
    name: 'reuses owned by a different user than their entry',
    sql: `SELECT r.id, r.user_id, e.user_id AS entry_user
          FROM text_entries_textentryreused r
          JOIN text_entries_textentry e ON e.id = r.text_entry_id
          WHERE r.user_id != e.user_id`,
    level: 'warn',
  },
];

/**
 * Non-empty emails used by more than one user. The schema makes emails unique
 * (logins find accounts by email), so these would fail the load; report them
 * clearly first instead.
 */
function duplicateEmails(converted: Converted[]): string[] {
  const found = converted.find(entry => entry.table === 'users_user');
  if (found === undefined) {
    return [];
  }
  const index = found.spec.columns.indexOf('email');
  const seen = new Map<string, number>();
  for (const row of found.rows) {
    const email = row[index];
    if (typeof email === 'string' && email !== '') {
      seen.set(email, (seen.get(email) ?? 0) + 1);
    }
  }
  return [...seen].filter(([, n]) => n > 1).map(([email]) => email);
}

export function verify(
  statements: string[],
  converted: Converted[],
  sequences: ReadonlyMap<string, number>,
  log: (line: string) => void = console.log
): boolean {
  const duplicates = duplicateEmails(converted);
  if (duplicates.length > 0) {
    log(
      `FAIL emails shared by more than one user (must be merged first): ${duplicates.length}`
    );
    for (const email of duplicates.slice(0, 5)) {
      log(`         ${email}`);
    }
    return false;
  }

  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  loadMigrations(db);
  for (const [index, statement] of statements.entries()) {
    try {
      db.run(statement);
    } catch (error) {
      // Name the statement, never echo it: its values include auth tokens.
      const target = /^(INSERT INTO|UPDATE) "?(\w+)"?/.exec(statement);
      throw new Error(
        `Import statement ${index + 1} (${target ? `${target[1]} ${target[2]}` : 'unknown'}) failed: ${(error as Error).message}`
      );
    }
  }

  let ok = true;
  log('\nRow counts (Postgres -> SQLite):');
  for (const {table, rows} of converted) {
    const {n} = db.query(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get() as {
      n: number;
    };
    const match = n === rows.length;
    ok &&= match;
    log(
      `  ${match ? 'ok ' : 'BAD'} ${table.padEnd(32)} ${rows.length} -> ${n}`
    );
  }

  log('\nChecks:');
  for (const check of CHECKS) {
    const found = db.query(check.sql).all() as Record<string, unknown>[];
    const status =
      found.length === 0 ? 'ok  ' : check.level === 'error' ? 'FAIL' : 'warn';
    log(`  ${status} ${check.name}${found.length ? `: ${found.length}` : ''}`);
    for (const row of found.slice(0, 5)) {
      log(`         ${JSON.stringify(row)}`);
    }
    if (found.length > 0 && check.level === 'error') {
      ok = false;
    }
  }

  // Every Postgres sequence position must have carried over, including for
  // tables that received no rows.
  const positions = new Map(
    (
      db.query('SELECT name, seq FROM sqlite_sequence').all() as Array<{
        name: string;
        seq: number;
      }>
    ).map(row => [row.name, row.seq])
  );
  log('\nAUTOINCREMENT positions (Postgres -> SQLite):');
  for (const {table} of converted) {
    const expected = sequences.get(table);
    const actual = positions.get(table);
    const match = expected === undefined || (actual ?? -1) >= expected;
    ok &&= match;
    log(
      `  ${match ? 'ok ' : 'BAD'} ${table.padEnd(32)} ${expected ?? '-'} -> ${actual ?? 'missing'}`
    );
  }
  return ok;
}

// ---------------------------------------------------------------------------

/** Set `date_updated` on the rows of `table` whose id is in `ids`. */
function touch(
  converted: Converted[],
  table: string,
  ids: ReadonlySet<Value>,
  timestamp: string
): void {
  const found = converted.find(entry => entry.table === table);
  if (found === undefined || ids.size === 0) {
    return;
  }
  const id = found.spec.columns.indexOf('id');
  const updated = found.spec.columns.indexOf('date_updated');
  for (const row of found.rows) {
    if (ids.has(row[id] as Value)) {
      row[updated] = timestamp;
    }
  }
}

/** Convert every imported table and re-rank scopes that have tied ranks. */
export function convertDump(dump: Dump): {
  converted: Converted[];
  skipped: string[];
  reranked: Record<string, number>;
} {
  const converted: Converted[] = Object.entries(TABLES).map(([table, spec]) => {
    const rows = dump.tables.get(table);
    if (rows === undefined) {
      throw new Error(`Table ${table} not found in the dump`);
    }
    return {table, spec, rows: rows.map(row => convert(table, spec, row))};
  });
  const reranked: Record<string, number> = {};
  const timestamp = now();
  for (const [table, scopeColumn] of [
    ['tags_tag', 'user_id'],
    ['tags_tagtextentrythroughmodel', 'tag_id'],
  ] as const) {
    const found = converted.find(entry => entry.table === table) as Converted;
    const changed = normalizeRanks(found, scopeColumn, timestamp);
    reranked[table] = changed.length;
    if (table === 'tags_tagtextentrythroughmodel') {
      // Clients pick junction changes up through /entries (included junctions),
      // which is filtered on the *entry's* date_updated: bump those entries too.
      const entryIndex = found.spec.columns.indexOf('text_entry_id');
      touch(
        converted,
        'text_entries_textentry',
        new Set(changed.map(row => row[entryIndex] as Value)),
        timestamp
      );
    }
  }
  const skipped = [...dump.tables.keys()].filter(table => !(table in TABLES));
  return {converted, skipped, reranked};
}

/** The CLI: convert, write, and verify. Returns the process exit code. */
export async function main(
  args: string[],
  log: (line: string) => void = console.log,
  pgRestore?: string
): Promise<number> {
  const archive = args.find(arg => !arg.startsWith('--'));
  const outIndex = args.indexOf('--out');
  const out =
    outIndex === -1
      ? path.join(import.meta.dirname, '..', 'data', 'import.sql')
      : (args[outIndex + 1] as string);
  if (archive === undefined) {
    log(
      'usage: bun scripts/import-postgres.ts <backup-pg_dump-Fc> [--out file.sql]'
    );
    return 2;
  }

  const dump = parseDump(await restoreToSql(archive, pgRestore));
  const {converted, skipped, reranked} = convertDump(dump);
  for (const [table, changed] of Object.entries(reranked)) {
    log(`Re-ranked ${changed} ${table} rows in scopes with tied ranks`);
  }

  const statements = buildStatements(converted, dump.sequences);
  const sql = renderSql(statements);
  mkdirSync(path.dirname(out), {recursive: true});
  writeFileSync(out, sql, {mode: 0o600});
  log(`Wrote ${out} (${(sql.length / 1024).toFixed(1)} KiB)`);
  log(`Skipped Django-internal tables: ${skipped.join(', ')}`);

  if (!verify(statements, converted, dump.sequences, log)) {
    log('\nVerification FAILED');
    return 1;
  }
  log('\nVerification passed.');
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
