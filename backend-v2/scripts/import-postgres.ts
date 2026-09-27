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

type Value = string | number | null;
type Row = Record<string, string | null>;

interface TableSpec {
  /** Columns to copy, in insert order. */
  columns: string[];
  booleans?: string[];
  integers?: string[];
  timestamps?: string[];
}

/** Tables to import, in foreign-key order. Everything else is Django-internal. */
const TABLES: Record<string, TableSpec> = {
  users_user: {
    // `password` is dropped: v2 has no password login.
    columns: [
      'id',
      'username',
      'email',
      'first_name',
      'last_name',
      'is_superuser',
      'is_staff',
      'is_active',
      'last_login',
      'date_joined',
      'date_updated',
      'login_count',
    ],
    booleans: ['is_superuser', 'is_staff', 'is_active'],
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

// ---------------------------------------------------------------------------
// Reading the archive
// ---------------------------------------------------------------------------

async function restoreToSql(archive: string): Promise<string> {
  const command = (process.env['PG_RESTORE'] ?? 'pg_restore').split(' ');
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
function decodeCopyField(field: string): string | null {
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

interface Dump {
  tables: Map<string, Row[]>;
  sequences: Map<string, number>;
}

function parseDump(sql: string): Dump {
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

function convert(table: string, spec: TableSpec, row: Row): Value[] {
  return spec.columns.map(column => {
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

interface Converted {
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
function normalizeRanks(found: Converted, scopeColumn: string): number {
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
  const timestamp = now();
  let changed = 0;
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
        changed++;
      }
    });
  }
  return changed;
}

function buildSql(
  converted: Converted[],
  sequences: Map<string, number>
): string {
  const out: string[] = [
    '-- Generated by scripts/import-postgres.ts. Contains user data: do not commit.',
    '-- Apply to an empty, migrated database.',
    '',
  ];
  for (const {table, spec, rows} of converted) {
    out.push(`-- ${table}: ${rows.length} rows`);
    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const values = rows
        .slice(i, i + ROWS_PER_INSERT)
        .map(row => `(${row.map(literal).join(', ')})`)
        .join(',\n  ');
      out.push(
        `INSERT INTO ${quote(table)} (${spec.columns.map(quote).join(', ')}) VALUES\n  ${values};`
      );
    }
    out.push('');
  }

  // Inserting junctions and reuses fired the counter triggers on top of the
  // counters copied from Postgres; put the source values back.
  out.push(
    '-- Restore denormalized counters exactly as they were in Postgres.'
  );
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
  out.push('');

  // Keep ids monotonic with Postgres so deleted ids are never reused.
  out.push('-- Carry Postgres sequence positions over to AUTOINCREMENT.');
  for (const {table} of converted) {
    const value = sequences.get(table);
    if (value !== undefined) {
      out.push(
        `UPDATE sqlite_sequence SET seq = MAX(seq, ${value}) WHERE name = '${table}';`
      );
    }
  }
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Verifying
// ---------------------------------------------------------------------------

function loadMigrations(db: Database): void {
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
    name: 'emails shared by more than one user (login looks users up by email)',
    sql: 'SELECT email, COUNT(*) AS n FROM users_user GROUP BY email HAVING n > 1',
    level: 'warn',
  },
];

function verify(sql: string, converted: Converted[]): boolean {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  loadMigrations(db);
  db.run(sql);

  let ok = true;
  console.log('\nRow counts (Postgres -> SQLite):');
  for (const {table, rows} of converted) {
    const {n} = db.query(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get() as {
      n: number;
    };
    const match = n === rows.length;
    ok &&= match;
    console.log(
      `  ${match ? 'ok ' : 'BAD'} ${table.padEnd(32)} ${rows.length} -> ${n}`
    );
  }

  console.log('\nChecks:');
  for (const check of CHECKS) {
    const found = db.query(check.sql).all() as Record<string, unknown>[];
    const status =
      found.length === 0 ? 'ok  ' : check.level === 'error' ? 'FAIL' : 'warn';
    console.log(
      `  ${status} ${check.name}${found.length ? `: ${found.length}` : ''}`
    );
    for (const row of found.slice(0, 5)) {
      console.log(`         ${JSON.stringify(row)}`);
    }
    if (found.length > 0 && check.level === 'error') {
      ok = false;
    }
  }

  const sequences = db
    .query('SELECT name, seq FROM sqlite_sequence ORDER BY name')
    .all();
  console.log('\nAUTOINCREMENT positions:');
  for (const row of sequences as Array<{name: string; seq: number}>) {
    console.log(`  ${row.name.padEnd(32)} ${row.seq}`);
  }
  return ok;
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const archive = args.find(arg => !arg.startsWith('--'));
  const outIndex = args.indexOf('--out');
  const out =
    outIndex === -1
      ? path.join(import.meta.dirname, '..', 'data', 'import.sql')
      : (args[outIndex + 1] as string);
  if (archive === undefined) {
    console.error(
      'usage: bun scripts/import-postgres.ts <backup-pg_dump-Fc> [--out file.sql]'
    );
    process.exit(2);
  }

  const {tables, sequences} = parseDump(await restoreToSql(archive));
  const converted: Converted[] = Object.entries(TABLES).map(([table, spec]) => {
    const rows = tables.get(table);
    if (rows === undefined) {
      throw new Error(`Table ${table} not found in ${archive}`);
    }
    return {table, spec, rows: rows.map(row => convert(table, spec, row))};
  });
  const skipped = [...tables.keys()].filter(table => !(table in TABLES));

  const rescoped: Array<[string, string]> = [
    ['tags_tag', 'user_id'],
    ['tags_tagtextentrythroughmodel', 'tag_id'],
  ];
  for (const [table, scopeColumn] of rescoped) {
    const found = converted.find(entry => entry.table === table) as Converted;
    const changed = normalizeRanks(found, scopeColumn);
    console.log(`Re-ranked ${changed} ${table} rows in scopes with tied ranks`);
  }

  const sql = buildSql(converted, sequences);
  mkdirSync(path.dirname(out), {recursive: true});
  writeFileSync(out, sql, {mode: 0o600});
  console.log(`Wrote ${out} (${(sql.length / 1024).toFixed(1)} KiB)`);
  console.log(`Skipped Django-internal tables: ${skipped.join(', ')}`);

  if (!verify(sql, converted)) {
    console.error('\nVerification FAILED');
    process.exit(1);
  }
  console.log('\nVerification passed.');
}

await main();
