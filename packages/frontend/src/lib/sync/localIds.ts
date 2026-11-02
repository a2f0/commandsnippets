const LOCAL_ID_PREFIX = 'local-';

/** A new local id, for a row not created on the API yet. */
export const localId = (): string =>
  `${LOCAL_ID_PREFIX}${globalThis.crypto.randomUUID()}`;

/** Whether `id` is a local one: the row is not on the API yet. */
export const isLocalId = (id: string): boolean =>
  id.startsWith(LOCAL_ID_PREFIX);
