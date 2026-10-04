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
 *
 * The tags are one live query per session, which every reader shares (the
 * tag list, and the entry list looking up the tag it shows): a tag switch
 * finds the new tag in it at once, and reads the database only for the
 * tag's entries.
 */
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {liveQuery} from 'dexie';
import {useLiveQuery} from 'dexie-react-hooks';
import {useLayoutEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {RowKey} from '../db/database';
import {timed} from '../metrics/timings';
import {useRouteParam} from '../router/navigation';
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
  // Only whose page: a tag switch renders none of the hooks' readers again.
  const user = useRouteParam('user');
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

/**
 * A session's tags as one live query that its readers share: run while
 * anyone reads it, `undefined` until the database first answers (and again
 * once no one reads it).
 */
interface SharedTags {
  /** The last answer (or failure), a new object for each. */
  state: TagsState;
  /** Read it (`useSyncExternalStore`): the same function for the session. */
  subscribe: (listener: () => void) => () => void;
}

interface TagsState {
  tags: Tag[] | undefined;
  error?: unknown;
}

const UNREAD: TagsState = {tags: undefined};

const sharedTags = new WeakMap<SyncSession, SharedTags>();

function tagsOf(session: SyncSession): SharedTags {
  const known = sharedTags.get(session);
  if (known !== undefined) {
    return known;
  }
  const listeners = new Set<() => void>();
  let subscription: {unsubscribe: () => void} | null = null;
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const shared: SharedTags = {
    state: UNREAD,
    subscribe: listener => {
      listeners.add(listener);
      subscription ??= liveQuery(() =>
        timed(
          'idb',
          'useTags',
          () => session.db.tags.where('owner').equals(session.owner).toArray(),
          rows
        )
      ).subscribe({
        next: tags => {
          shared.state = {tags};
          notify();
        },
        error: (error: unknown) => {
          shared.state = {tags: shared.state.tags, error};
          notify();
        },
      });
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          subscription?.unsubscribe();
          subscription = null;
          shared.state = UNREAD;
        }
      };
    },
  };
  sharedTags.set(session, shared);
  return shared;
}

const NO_TAGS: TagsState = {tags: []};
const subscribeToNothing = () => () => {};

/**
 * The tags, deleted ones too (none when signed out). A failed read throws,
 * for the error boundary, as `useLiveQuery` does.
 */
export function useTags(): Tag[] | undefined {
  const session = useSession();
  const shared = session === null ? null : tagsOf(session);
  const {tags, error} = useSyncExternalStore(
    shared?.subscribe ?? subscribeToNothing,
    () => (shared === null ? NO_TAGS : shared.state)
  );
  if (error !== undefined) {
    throw error;
  }
  return tags;
}

/** The tag named `name` (not deleted), or null, and the name asked for. */
type TagNamed = {name: string | undefined; tag: Tag | null};

const isNamed = (name: string) => (tag: Tag) =>
  tag.attributes.name === name && !tag.attributes.is_deleted;

/**
 * The tag named `name` (not deleted), null when there is none, and the name
 * it is of. Looked up in the tags (`useTags`), so a new name finds its tag
 * at once (a tag switch) with no read of its own. A name not among them is
 * read from the database (a tag just renamed to it, before the tags are
 * read again; or no tag of the name), the last answer standing until then,
 * as a query asked for something else does: no empty list in between.
 */
export function useTagNamed(name: string | undefined): TagNamed | undefined {
  const session = useSession();
  const tags = useTags();
  const found =
    name === undefined || tags === undefined
      ? undefined
      : tags.find(isNamed(name));
  const missed = tags !== undefined && name !== undefined && !found;
  const lookedUp = useLiveQuery(
    async (): Promise<TagNamed | undefined> =>
      !missed || name === undefined || session === null
        ? undefined
        : {
            name,
            tag:
              (await timed('idb', 'useTagNamed', () =>
                session.db.tags
                  .where('owner')
                  .equals(session.owner)
                  .filter(isNamed(name))
                  .first()
              )) ?? null,
          },
    [session, name, missed]
  );
  // The answer the page shows, which a name still being read keeps.
  const shown = useRef<TagNamed | undefined>(undefined);
  const answer = useMemo((): TagNamed | undefined => {
    if (tags === undefined) {
      return undefined;
    }
    if (name === undefined) {
      return {name, tag: null};
    }
    if (found !== undefined) {
      return {name, tag: found};
    }
    return lookedUp?.name === name ? lookedUp : shown.current;
  }, [tags, name, found, lookedUp]);
  useLayoutEffect(() => {
    shown.current = answer;
  });
  return answer;
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
