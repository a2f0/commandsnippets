/**
 * The signed-in user's data as the UI reads it: live queries of their
 * IndexedDB database (`dexie-react-hooks`), so a list shows each change the
 * moment a sync or a write stores it, whichever tab it came from. Each is
 * `undefined` until the database answers the first time.
 */
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {useLiveQuery} from 'dexie-react-hooks';
import type {CommandsnippetsDatabase} from '../db/database';
import {useAppState} from '../state/appState';
import {type SyncSession, syncSession} from '../sync/session';
import type {TaggedEntry} from './sort';

/** The signed-in user's database and sync, or null when signed out. */
export function useSession(): SyncSession | null {
  const username = useAppState(state => state.loggedInUser);
  return username === null ? null : syncSession(username);
}

/** The user's tags, deleted ones too. */
export function useTags(): Tag[] | undefined {
  const db = useSession()?.db;
  return useLiveQuery(() => db?.tags.toArray() ?? [], [db]);
}

/** The user's tag named `name` (not deleted), null when there is none. */
export function useTagNamed(name: string | undefined): Tag | null | undefined {
  const db = useSession()?.db;
  return useLiveQuery(
    async () =>
      name === undefined || db === undefined
        ? null
        : ((await db.tags
            .filter(
              tag => tag.attributes.name === name && !tag.attributes.is_deleted
            )
            .first()) ?? null),
    [db, name]
  );
}

/** Tag `tagId`'s junctions not deleted. */
const tagJunctions = (db: CommandsnippetsDatabase, tagId: string) =>
  db.junctions
    .where('relationships.tag.data.id')
    .equals(tagId)
    .filter(junction => !junction.attributes.is_deleted)
    .toArray();

/** Tag `tagId`'s entries (not deleted), each with its junction. */
export async function entriesOfTag(
  db: CommandsnippetsDatabase,
  tagId: string
): Promise<TaggedEntry[]> {
  const junctions = await tagJunctions(db, tagId);
  const entries = await db.entries.bulkGet(
    junctions.map(junction => junction.relationships.text_entry.data.id)
  );
  return junctions.flatMap((junction, index) => {
    const entry = entries[index];
    return entry === undefined || entry.attributes.is_deleted
      ? []
      : [{entry, junction}];
  });
}

/** Tag `tagId`'s entries, each with its junction. */
export function useTagEntries(
  tagId: string | undefined
): TaggedEntry[] | undefined {
  const db = useSession()?.db;
  return useLiveQuery(
    () =>
      tagId === undefined || db === undefined ? [] : entriesOfTag(db, tagId),
    [db, tagId]
  );
}

/** The user's entries not deleted, and whether each is in any tag. */
async function liveEntries(
  db: CommandsnippetsDatabase
): Promise<Array<{entry: TextEntry; tagged: boolean}>> {
  const [entries, junctions] = await Promise.all([
    db.entries.filter(entry => !entry.attributes.is_deleted).toArray(),
    db.junctions.filter(junction => !junction.attributes.is_deleted).toArray(),
  ]);
  const tagged = new Set(
    junctions.map(junction => junction.relationships.text_entry.data.id)
  );
  return entries.map(entry => ({entry, tagged: tagged.has(entry.id)}));
}

/** The user's entries (not deleted): all of them, or those in no tag. */
export function useEntries(which: 'all' | 'untagged'): TextEntry[] | undefined {
  const db = useSession()?.db;
  return useLiveQuery(
    async () =>
      db === undefined
        ? []
        : (await liveEntries(db))
            .filter(({tagged}) => which === 'all' || !tagged)
            .map(({entry}) => entry),
    [db, which]
  );
}

/** The junction putting entry `entryId` in tag `tagId`, when there is one. */
export async function junctionOf(
  db: CommandsnippetsDatabase,
  tagId: string,
  entryId: string
): Promise<TagTextEntry | undefined> {
  return (await tagJunctions(db, tagId)).find(
    junction => junction.relationships.text_entry.data.id === entryId
  );
}
