/** The D1 migrations (`migrations/*.sql`), for loading into bun:sqlite. */
import type {Database} from 'bun:sqlite';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', '..', 'migrations');

/** Every migration's file name, in the order D1 applies them. */
export function files(): string[] {
  return readdirSync(DIR)
    .filter(name => name.endsWith('.sql'))
    .sort();
}

export function read(file: string): string {
  return readFileSync(path.join(DIR, file), 'utf8');
}

/** Run one migration, a statement at a time (drizzle-kit's breakpoints). */
export function apply(db: Database, file: string): void {
  for (const statement of read(file).split('--> statement-breakpoint')) {
    if (statement.trim() !== '') {
      db.run(statement);
    }
  }
}

/** Run every migration, or only those up to and including `through`. */
export function load(db: Database, {through}: {through?: string} = {}): void {
  const all = files();
  if (through !== undefined && !all.includes(through)) {
    throw new Error(`No migration named ${through}`);
  }
  const end = through === undefined ? all.length : all.indexOf(through) + 1;
  for (const file of all.slice(0, end)) {
    apply(db, file);
  }
}
