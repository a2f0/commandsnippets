/**
 * The key the UI gives a stored row (`Stored` in `lib/db/database.ts`): its
 * local id, if it had one. A row made here keeps its local id once the API's
 * replaces it, so its list item (and an editor open on it) stays the same
 * component.
 */
export const keyOfRow = (row: {id: string; localId?: string | undefined}) =>
  row.localId ?? row.id;
