import {Database} from 'bun:sqlite';
import {describe, expect, test} from 'bun:test';
import {
  allColumns,
  buildStatements,
  convert,
  convertDump,
  decodeCopyField,
  MAX_STATEMENT_BYTES,
  parseDump,
  renderSql,
  TABLES,
  verify,
} from './import-postgres';
import * as migrations from './lib/migrations';

const T = '\t';
const row = (...fields: string[]) => fields.join(T);
const TOKEN = 'a'.repeat(40);

/** What `pg_restore --data-only -f -` prints for a small Django database. */
const DUMP = [
  '--',
  '-- Data for Name: users_user; Type: TABLE DATA; Schema: public',
  '--',
  '',
  'COPY public.users_user (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, date_updated, login_count) FROM stdin;',
  row(
    '1',
    'pbkdf2_sha256$secret',
    '2021-11-15 17:57:23.366384+00',
    'f',
    'alice',
    '',
    '',
    'alice@example.com',
    'f',
    't',
    '2021-11-15 17:57:23.366384+00',
    '2021-11-15 17:57:23.367596+00',
    '3'
  ),
  row(
    '2',
    '',
    '\\N',
    'f',
    "o'brien",
    '',
    '',
    'ob@example.com',
    'f',
    't',
    '2022-01-01 00:00:00+00',
    '2022-01-01 00:00:00.5+00',
    '1'
  ),
  '\\.',
  '',
  'COPY public.authtoken_token (key, created, user_id) FROM stdin;',
  row(TOKEN, '2022-01-19 08:49:39.564629+00', '1'),
  '\\.',
  '',
  'COPY public.text_entries_textentry (id, body, date_created, date_updated, subject, user_id, is_deleted, tag_count, reused_count, reused_date) FROM stdin;',
  row(
    '10',
    'SELECT *\\nFROM t\\twhere \\\\l',
    '2020-08-03 02:37:27.850184+00',
    '2020-08-03 02:37:27.850203+00',
    "it's \\101 subject",
    '1',
    'f',
    '2',
    '0',
    '\\N'
  ),
  row(
    '11',
    'body',
    '2020-08-04 00:00:00+00',
    '2020-08-04 00:00:00+00',
    'other',
    '2',
    't',
    '0',
    '0',
    '\\N'
  ),
  '\\.',
  '',
  'COPY public.tags_tag (id, name, date_created, date_updated, user_id, entry_count, date_last_used, "order", is_deleted) FROM stdin;',
  row(
    '20',
    'a',
    '2021-01-01 00:00:00+00',
    '2021-01-01 00:00:00+00',
    '1',
    '1',
    '2021-02-01 00:00:00+00',
    '5',
    'f'
  ),
  row(
    '21',
    'b',
    '2021-01-01 00:00:00+00',
    '2021-01-01 00:00:00+00',
    '1',
    '1',
    '2021-02-02 00:00:00+00',
    '5',
    'f'
  ),
  row(
    '22',
    'c',
    '2021-01-01 00:00:00+00',
    '2021-01-01 00:00:00+00',
    '2',
    '0',
    '\\N',
    '1',
    'f'
  ),
  '\\.',
  '',
  'COPY public.tags_tagtextentrythroughmodel (id, "order", tag_id, text_entry_id, date_created, date_updated, user_id) FROM stdin;',
  row(
    '30',
    '3',
    '20',
    '10',
    '2021-03-01 00:00:00+00',
    '2021-03-01 00:00:00+00',
    '1'
  ),
  row(
    '31',
    '3',
    '21',
    '10',
    '2021-03-02 00:00:00+00',
    '2021-03-02 00:00:00+00',
    '1'
  ),
  '\\.',
  '',
  'COPY public.text_entries_textentryreused (id, date_created, text_entry_id, user_id) FROM stdin;',
  '\\.',
  '',
  'COPY public.django_session (session_key, session_data, expire_date) FROM stdin;',
  row('k', 'd', '2021-01-01 00:00:00+00'),
  '\\.',
  '',
  "SELECT pg_catalog.setval('public.users_user_id_seq', 24, true);",
  "SELECT pg_catalog.setval('public.tags_tag_id_seq', 200, true);",
  "SELECT pg_catalog.setval('public.tags_tagtextentrythroughmodel_id_seq', 999, true);",
  "SELECT pg_catalog.setval('public.text_entries_textentry_id_seq', 855, true);",
  "SELECT pg_catalog.setval('public.text_entries_textentryreused_id_seq', 61, true);",
  "SELECT pg_catalog.setval('public.auth_group_id_seq', 1, false);",
  '',
].join('\n');

function imported() {
  const dump = parseDump(DUMP);
  const result = convertDump(dump);
  const statements = buildStatements(result.converted, dump.sequences);
  return {dump, ...result, statements};
}

function load(statements: string[]): Database {
  const db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  migrations.load(db);
  for (const statement of statements) {
    db.run(statement);
  }
  return db;
}

describe('decodeCopyField', () => {
  test('decodes NULL and every COPY escape', () => {
    expect(decodeCopyField('\\N')).toBeNull();
    expect(decodeCopyField('a\\tb\\nc\\rd\\\\e')).toBe('a\tb\nc\rd\\e');
    expect(decodeCopyField('\\b\\f\\v')).toBe('\b\f\v');
    expect(decodeCopyField('\\101\\x42')).toBe('AB');
    expect(decodeCopyField('\\q')).toBe('q');
    expect(decodeCopyField('')).toBe('');
  });
});

describe('parseDump', () => {
  test('reads every COPY block and sequence position', () => {
    const {tables, sequences} = parseDump(DUMP);
    expect([...tables.keys()]).toEqual([
      'users_user',
      'authtoken_token',
      'text_entries_textentry',
      'tags_tag',
      'tags_tagtextentrythroughmodel',
      'text_entries_textentryreused',
      'django_session',
    ]);
    expect(tables.get('text_entries_textentryreused')).toEqual([]);
    expect(tables.get('text_entries_textentry')?.[0]?.['body']).toBe(
      'SELECT *\nFROM t\twhere \\l'
    );
    expect(sequences.get('text_entries_textentryreused')).toBe(61);
    // is_called=false means the next value is the given one itself.
    expect(sequences.get('auth_group')).toBe(0);
  });

  test('rejects rows with the wrong field count', () => {
    expect(() =>
      parseDump('COPY public.t (a, b) FROM stdin;\nonly-one\n\\.\n')
    ).toThrow('expected 2 fields, got 1');
  });

  test('rejects an unterminated COPY block', () => {
    expect(() => parseDump('COPY public.t (a) FROM stdin;\nx')).toThrow(
      'Unterminated COPY block for t'
    );
  });
});

describe('convert', () => {
  const spec = TABLES['users_user'];
  if (spec === undefined) {
    throw new Error('users_user spec missing');
  }
  const user = parseDump(DUMP).tables.get('users_user')?.[0] ?? {};

  test('drops the password and is_superuser, converts booleans and timestamps', () => {
    const values = convert('users_user', spec, user);
    expect(spec.columns).not.toContain('password');
    expect(spec.columns).not.toContain('is_superuser');
    expect(values).toEqual([
      1,
      'alice',
      'alice@example.com',
      '',
      '',
      0,
      1,
      '2021-11-15T17:57:23.366384',
      '2021-11-15T17:57:23.366384',
      '2021-11-15T17:57:23.367596',
      3,
      // last_active, computed from last_login
      '2021-11-15T17:57:23.366384',
    ]);
  });

  test('rejects malformed values and missing columns', () => {
    expect(() =>
      convert('users_user', spec, {...user, is_staff: 'yes'})
    ).toThrow('bad boolean');
    expect(() =>
      convert('users_user', spec, {...user, date_joined: 'soon'})
    ).toThrow('bad timestamp');
    const {email: _email, ...withoutEmail} = user;
    expect(() => convert('users_user', spec, withoutEmail)).toThrow(
      'column email missing'
    );
  });
});

describe('convertDump', () => {
  test('re-ranks only tied scopes and bumps their date_updated', () => {
    const {converted, skipped, reranked} = imported();
    expect(skipped).toEqual(['django_session']);
    expect(reranked).toEqual({
      tags_tag: 2,
      tags_tagtextentrythroughmodel: 0,
    });
    const tags = converted.find(c => c.table === 'tags_tag');
    const columns = tags?.spec.columns ?? [];
    const byId = new Map(
      (tags?.rows ?? []).map(r => [r[columns.indexOf('id')], r])
    );
    const order = columns.indexOf('order');
    const updated = columns.indexOf('date_updated');
    expect(byId.get(20)?.[order]).toBe(0);
    expect(byId.get(21)?.[order]).toBe(1);
    expect(byId.get(22)?.[order]).toBe(1);
    expect(byId.get(20)?.[updated]).not.toBe('2021-01-01T00:00:00.000000');
    expect(byId.get(22)?.[updated]).toBe('2021-01-01T00:00:00.000000');
  });

  test('bumps entries whose junctions were re-ranked, and only those', () => {
    const dump = parseDump(DUMP);
    const junctions = dump.tables.get('tags_tagtextentrythroughmodel') ?? [];
    // Tie junctions 30 and 31 at rank 0 inside tag 20, on entries 10 and 11.
    junctions[0] = {
      ...junctions[0],
      tag_id: '20',
      text_entry_id: '10',
      order: '0',
    };
    junctions[1] = {
      ...junctions[1],
      tag_id: '20',
      text_entry_id: '11',
      order: '0',
    };
    const {converted, reranked} = convertDump(dump);
    expect(reranked['tags_tagtextentrythroughmodel']).toBe(1);

    const rows = (table: string) => {
      const found = converted.find(c => c.table === table);
      const columns = found?.spec.columns ?? [];
      return new Map(
        (found?.rows ?? []).map(r => [
          r[columns.indexOf('id')],
          Object.fromEntries(columns.map((c, i) => [c, r[i]])),
        ])
      );
    };
    const junction = rows('tags_tagtextentrythroughmodel');
    const entries = rows('text_entries_textentry');
    expect(junction.get(31)?.['order']).toBe(1);
    // The client syncs junctions through /entries, filtered on the entry.
    expect(entries.get(11)?.['date_updated']).toBe(
      junction.get(31)?.['date_updated']
    );
    expect(entries.get(10)?.['date_updated']).toBe(
      '2020-08-03T02:37:27.850203'
    );
  });

  test('requires every imported table', () => {
    expect(() =>
      convertDump(parseDump('COPY public.users_user (id) FROM stdin;\n\\.\n'))
    ).toThrow();
  });
});

describe('buildStatements', () => {
  test('passes its own verification', () => {
    const {statements, converted, dump} = imported();
    const lines: string[] = [];
    expect(
      verify(statements, converted, dump.sequences, line => lines.push(line))
    ).toBe(true);
    expect(lines.join('\n')).not.toContain('BAD');
    expect(lines.join('\n')).not.toContain('FAIL');
  });

  test('restores counters exactly, despite the triggers firing on insert', () => {
    const db = load(imported().statements);
    expect(
      db
        .query(
          'SELECT id, entry_count, date_last_used FROM tags_tag ORDER BY id'
        )
        .all()
    ).toEqual([
      {id: 20, entry_count: 1, date_last_used: '2021-02-01T00:00:00.000000'},
      {id: 21, entry_count: 1, date_last_used: '2021-02-02T00:00:00.000000'},
      {id: 22, entry_count: 0, date_last_used: null},
    ]);
    expect(
      db
        .query('SELECT tag_count FROM text_entries_textentry WHERE id = 10')
        .get()
    ).toEqual({tag_count: 2});
  });

  test('computes Unicode search folds for imported entries', () => {
    const dump = parseDump(DUMP);
    const entry = dump.tables.get('text_entries_textentry')?.[0] ?? {};
    const db = load(
      buildStatements(
        convertDump({
          ...dump,
          tables: new Map(dump.tables).set('text_entries_textentry', [
            {...entry, subject: 'Über Straßen', body: 'ÇA VA'},
          ]),
        }).converted,
        dump.sequences
      )
    );
    expect(
      db
        .query(
          'SELECT subject_folded, body_folded FROM text_entries_textentry WHERE id = 10'
        )
        .get()
    ).toEqual({subject_folded: 'ÜBER STRASSEN', body_folded: 'ÇA VA'});
  });

  test('starts last_active at the last login', () => {
    const db = load(imported().statements);
    expect(
      db
        .query('SELECT id, last_login, last_active FROM users_user ORDER BY id')
        .all()
    ).toEqual([
      {
        id: 1,
        last_login: '2021-11-15T17:57:23.366384',
        last_active: '2021-11-15T17:57:23.366384',
      },
      {id: 2, last_login: null, last_active: null},
    ]);
  });

  test('keeps text byte-for-byte, including quotes and escapes', () => {
    const db = load(imported().statements);
    expect(
      db
        .query('SELECT body, subject FROM text_entries_textentry WHERE id = 10')
        .get()
    ).toEqual({body: 'SELECT *\nFROM t\twhere \\l', subject: "it's A subject"});
    expect(
      db.query('SELECT username FROM users_user WHERE id = 2').get()
    ).toEqual({username: "o'brien"});
  });

  test('carries sequence positions over, including for empty tables', () => {
    const db = load(imported().statements);
    const next = (insert: string) => {
      db.run(insert);
      return (
        db.query('SELECT last_insert_rowid() AS id').get() as {id: number}
      ).id;
    };
    // text_entries_textentryreused had no rows: its position must survive.
    expect(
      next(
        "INSERT INTO text_entries_textentryreused (date_created, text_entry_id, user_id) VALUES ('x', 10, 1)"
      )
    ).toBe(62);
    expect(
      next(
        "INSERT INTO tags_tag (name, date_created, date_updated, user_id, \"order\") VALUES ('new', 'x', 'x', 1, 9)"
      )
    ).toBe(201);
  });
});

describe('statement size', () => {
  test('keeps every statement under the D1 limit for maximum-length unicode rows', () => {
    const {converted, dump} = imported();
    const entries = converted.find(c => c.table === 'text_entries_textentry');
    if (entries === undefined) {
      throw new Error('entries missing');
    }
    const columns = allColumns(entries.spec);
    const template = entries.rows[0] ?? [];
    // 60 entries with the longest body and subject Django allowed, in
    // four-byte characters, plus their folded copies: ~10 KB each, so 25 rows
    // would be ~250 KB.
    const body = '😀'.repeat(1024);
    const subject = '😀'.repeat(255);
    const big = Array.from({length: 60}, (_, i) =>
      template.map((value, c) => {
        switch (columns[c]) {
          case 'id':
            return 1000 + i;
          case 'body':
          case 'body_folded':
            return body;
          case 'subject':
          case 'subject_folded':
            return subject;
          case 'tag_count':
            return 0;
          default:
            return value;
        }
      })
    );
    const withBig = converted.map(c =>
      c === entries ? {...c, rows: [...c.rows, ...big]} : c
    );
    const statements = buildStatements(withBig, dump.sequences);
    const sizes = statements.map(s => new TextEncoder().encode(s).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_STATEMENT_BYTES);
    const entryInserts = statements.filter(s =>
      s.startsWith('INSERT INTO "text_entries_textentry"')
    );
    expect(entryInserts.length).toBeGreaterThan(Math.ceil(62 / 25));
    // Nothing is lost by the extra batching.
    const db = load(statements);
    expect(
      (
        db.query('SELECT COUNT(*) AS n FROM text_entries_textentry').get() as {
          n: number;
        }
      ).n
    ).toBe(62);
    expect(
      (
        db
          .query(
            'SELECT length(body) AS n FROM text_entries_textentry WHERE id = 1000'
          )
          .get() as {n: number}
      ).n
    ).toBe(1024);
  });
});

describe('verify', () => {
  test('refuses data that breaks a foreign key (D1 enforces them too)', () => {
    const {converted, dump} = imported();
    const broken = converted.map(c =>
      c.table === 'tags_tagtextentrythroughmodel'
        ? {
            ...c,
            // Point one junction at a tag that does not exist.
            rows: c.rows.map((r, rowIndex) =>
              rowIndex === 0 ? r.map((v, i) => (i === 2 ? 9999 : v)) : r
            ),
          }
        : c
    );
    expect(() =>
      verify(
        buildStatements(broken, dump.sequences),
        broken,
        dump.sequences,
        () => {}
      )
    ).toThrow(
      /Import statement \d+ \(INSERT INTO tags_tagtextentrythroughmodel\) failed: FOREIGN KEY constraint failed/
    );
  });

  test('never echoes statement values (auth tokens) in its errors', () => {
    const {converted, dump} = imported();
    const broken = converted.map(c =>
      c.table === 'authtoken_token'
        ? {...c, rows: c.rows.map(r => [r[0] ?? null, r[1] ?? null, 999])}
        : c
    );
    let message = '';
    try {
      verify(
        buildStatements(broken, dump.sequences),
        broken,
        dump.sequences,
        () => {}
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('(INSERT INTO authtoken_token) failed');
    expect(message).not.toContain(TOKEN);
  });

  test('fails clearly, before loading, on emails shared by two users', () => {
    const dump = parseDump(DUMP);
    const people = dump.tables.get('users_user') ?? [];
    people[1] = {...people[1], email: people[0]?.['email'] ?? null};
    const {converted} = convertDump(dump);
    const lines: string[] = [];
    expect(
      verify(
        buildStatements(converted, dump.sequences),
        converted,
        dump.sequences,
        line => lines.push(line)
      )
    ).toBe(false);
    expect(lines.join('\n')).toContain(
      'FAIL emails shared by more than one user (must be merged first): 1'
    );
  });

  test("fails on a username reserved for the web app's routes", () => {
    const dump = parseDump(DUMP);
    const people = dump.tables.get('users_user') ?? [];
    people[0] = {...people[0], username: 'Admin'};
    const {converted} = convertDump(dump);
    const lines: string[] = [];
    expect(
      verify(
        buildStatements(converted, dump.sequences),
        converted,
        dump.sequences,
        line => lines.push(line)
      )
    ).toBe(false);
    expect(lines.join('\n')).toContain(
      'FAIL usernames reserved for web app routes (rename them first): 1'
    );
  });

  test('fails when a sequence position does not carry over', () => {
    const {converted, dump, statements} = imported();
    const lines: string[] = [];
    const withoutEmptyTableSequence = statements.filter(
      statement =>
        !(
          statement.startsWith('INSERT INTO sqlite_sequence') &&
          statement.includes('text_entries_textentryreused')
        )
    );
    expect(
      verify(withoutEmptyTableSequence, converted, dump.sequences, line =>
        lines.push(line)
      )
    ).toBe(false);
    expect(lines.join('\n')).toMatch(
      /BAD text_entries_textentryreused\s+61 -> missing/
    );
  });
});

describe('renderSql', () => {
  test('writes a header and every statement', () => {
    const {statements} = imported();
    const file = renderSql(statements);
    expect(file.startsWith('-- Generated by scripts/import-postgres.ts')).toBe(
      true
    );
    expect(file.trimEnd().endsWith(statements.at(-1) ?? '')).toBe(true);
  });
});
