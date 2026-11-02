/**
 * The reads both what the UI shows (`hooks.ts`) and the writes
 * (`writes.ts`) make of an owner's rows.
 */
import type {TagTextEntry} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import type {RowKey, Stored} from '../db/database';
import {isLocalId} from '../sync/localIds';
import type {SyncSession} from '../sync/session';
import type {TaggedEntry} from './sort';

/** Whose data a query reads: a session's database and owner. */
export type OwnedData = Pick<SyncSession, 'db' | 'owner'>;

/** Tag `tagId`'s junctions not deleted. */
export const tagJunctions = ({db, owner}: OwnedData, tagId: string) =>
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

/**
 * The row `id` names: the row of that id, or for a local id the API's id has
 * replaced meanwhile (an editor opened before its create was sent), the row
 * holding it (`localId`).
 */
export async function rowNamed<R>(
  table: Table<Stored<R>, RowKey>,
  owner: string,
  id: string
): Promise<Stored<R> | undefined> {
  const row = await table.get([owner, id]);
  if (row !== undefined || !isLocalId(id)) {
    return row;
  }
  return table
    .where('owner')
    .equals(owner)
    .filter(candidate => candidate.localId === id)
    .first();
}

/** The id the row `id` names has now (see `rowNamed`). */
export async function idNow<R extends {id: string}>(
  table: Table<Stored<R>, RowKey>,
  owner: string,
  id: string
): Promise<string> {
  return (await rowNamed(table, owner, id))?.id ?? id;
}
