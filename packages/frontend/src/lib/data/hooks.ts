/**
 * The data the UI shows, as it reads it: live queries of the signed-in
 * user's IndexedDB database (`dexie-react-hooks`), so a list shows each
 * change the moment a sync or a write stores it, whichever tab it came from.
 * Each is `undefined` until the database answers the first time.
 *
 * Owners read their own data; staff read other users' full data; other
 * visitors read public data. Every query names whose (`useOwner`).
 *
 * Each run of a query is timed for the HUD (`lib/metrics/`), by the hook's
 * name. A query asked for something else keeps answering with its last
 * rows until the new ones are read: the lists' hooks name what their rows
 * are of.
 */
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {useLiveQuery} from 'dexie-react-hooks';
import {useSyncExternalStore} from 'react';
import {useParams} from 'react-router-dom';
import type {RowKey} from '../db/database';
import {timed} from '../metrics/timings';
import {useAppState} from '../state/appState';
import {
  publicSyncSession,
  type SyncSession,
  sessionsEndedCount,
  subscribeSessions,
  syncSession,
} from '../sync/session';
import type {TaggedEntry} from './sort';

/** Whose data a query reads: a session's database and owner. */
export type OwnedData = Pick<SyncSession, 'db' | 'owner'>;

export interface Owner {
  /** The username whose data the page shows. */
  owner: string;
  /** Another user's data, which the page only shows. */
  readOnly: boolean;
  publicOnly: boolean;
}

/**
 * The route's owner, or the signed-in user at the root. Other users' pages
 * are read-only; only staff get a full view. Guests use the public view.
 */
export function useOwner(): Owner | null {
  const username = useAppState(state => state.loggedInUser);
  const isStaff = useAppState(state => state.isStaff);
  const {user} = useParams();
  if (username === null) {
    return user === undefined
      ? null
      : {owner: user, readOnly: true, publicOnly: true};
  }
  if (user === undefined || user === username) {
    return {owner: username, readOnly: false, publicOnly: false};
  }
  return {owner: user, readOnly: true, publicOnly: !isStaff};
}

/** Whether the page shows another user's data, which it only shows. */
export function useReadOnly(): boolean {
  return useOwner()?.readOnly ?? false;
}

/**
 * The session of the data the page shows (`useOwner`), or null when signed
 * out: another when the sessions end under the user (another tab signed out
 * and in).
 */
export function useSession(): SyncSession | null {
  const username = useAppState(state => state.loggedInUser);
  const context = useOwner();
  const owner = context?.owner;
  useSyncExternalStore(subscribeSessions, sessionsEndedCount);
  if (owner === undefined) return null;
  if (context?.publicOnly) return publicSyncSession(owner);
  return username === null ? null : syncSession(username, owner);
}

const rows = (list: readonly unknown[]) => `${list.length} rows`;

/** The tags, deleted ones too. */
export function useTags(): Tag[] | undefined {
  const session = useSession();
  return useLiveQuery(
    () =>
      session === null
        ? []
        : timed(
            'idb',
            'useTags',
            () =>
              session.db.tags.where('owner').equals(session.owner).toArray(),
            rows
          ),
    [session]
  );
}

/**
 * The tag named `name` (not deleted), null when there is none, and the name
 * it is of.
 */
export function useTagNamed(
  name: string | undefined
): {name: string | undefined; tag: Tag | null} | undefined {
  const session = useSession();
  return useLiveQuery(
    async () => ({
      name,
      tag:
        name === undefined || session === null
          ? null
          : ((await timed('idb', 'useTagNamed', () =>
              session.db.tags
                .where('owner')
                .equals(session.owner)
                .filter(
                  tag =>
                    tag.attributes.name === name && !tag.attributes.is_deleted
                )
                .first()
            )) ?? null),
    }),
    [session, name]
  );
}

/** Tag `tagId`'s junctions not deleted. */
const tagJunctions = ({db, owner}: OwnedData, tagId: string) =>
  db.junctions
    .where('[owner+relationships.tag.data.id]')
    .equals([owner, tagId])
    .filter(junction => !junction.attributes.is_deleted)
    .toArray();

/** Tag `tagId`'s entries (not deleted), each with its junction. */
export async function entriesOfTag(
  data: OwnedData,
  tagId: string
): Promise<TaggedEntry[]> {
  const junctions = await tagJunctions(data, tagId);
  const entries = await data.db.entries.bulkGet(
    junctions.map(
      (junction): RowKey => [
        data.owner,
        junction.relationships.text_entry.data.id,
      ]
    )
  );
  return junctions.flatMap((junction, index) => {
    const entry = entries[index];
    return entry === undefined || entry.attributes.is_deleted
      ? []
      : [{entry, junction}];
  });
}

/** Tag `tagId`'s entries, each with its junction, and the tag they are of. */
export function useTagEntries(
  tagId: string | undefined
): {tagId: string | undefined; entries: TaggedEntry[]} | undefined {
  const session = useSession();
  return useLiveQuery(
    async () => ({
      tagId,
      entries:
        tagId === undefined || session === null
          ? []
          : await timed(
              'idb',
              'useTagEntries',
              () => entriesOfTag(session, tagId),
              rows
            ),
    }),
    [session, tagId]
  );
}

/** The entries not deleted, and whether each is in any tag. */
async function liveEntries({
  db,
  owner,
}: OwnedData): Promise<Array<{entry: TextEntry; tagged: boolean}>> {
  const [entries, junctions] = await Promise.all([
    db.entries
      .where('owner')
      .equals(owner)
      .filter(entry => !entry.attributes.is_deleted)
      .toArray(),
    db.junctions
      .where('owner')
      .equals(owner)
      .filter(junction => !junction.attributes.is_deleted)
      .toArray(),
  ]);
  const tagged = new Set(
    junctions.map(junction => junction.relationships.text_entry.data.id)
  );
  return entries.map(entry => ({entry, tagged: tagged.has(entry.id)}));
}

/**
 * The entries (not deleted): all of them, or those in no tag; none (`null`)
 * for a list that shows neither, which reads nothing. With which they are.
 */
export function useEntries(
  which: 'all' | 'untagged' | null
): {which: 'all' | 'untagged' | null; entries: TextEntry[]} | undefined {
  const session = useSession();
  return useLiveQuery(
    async () => ({
      which,
      entries:
        session === null || which === null
          ? []
          : (
              await timed(
                'idb',
                `useEntries(${which})`,
                () => liveEntries(session),
                rows
              )
            )
              .filter(({tagged}) => which === 'all' || !tagged)
              .map(({entry}) => entry),
    }),
    [session, which]
  );
}

/** The junction putting entry `entryId` in tag `tagId`, when there is one. */
export async function junctionOf(
  data: OwnedData,
  tagId: string,
  entryId: string
): Promise<(TagTextEntry & {owner: string}) | undefined> {
  return (await tagJunctions(data, tagId)).find(
    junction => junction.relationships.text_entry.data.id === entryId
  );
}
