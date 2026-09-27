import {describe, expect, it} from 'vitest';
import {
  createRegistry,
  TAG_TEXT_ENTRY,
  TEXT_ENTRY_REUSED,
} from '../../src/resources/serializers';
import {
  db,
  entriesOf,
  junctionsOf,
  setUpBase,
  textEntryReusedFactory,
} from '../helpers';

describe('resource registry loaders', () => {
  it('loads junctions and reuses by id', async () => {
    const {user1} = await setUpBase();
    const [entry] = await entriesOf(user1);
    const junctions = await junctionsOf(entry as never);
    const reuse = await textEntryReusedFactory({
      text_entry: entry as never,
      user: user1,
    });
    const registry = createRegistry(db());
    const loadedJunctions = (await registry[TAG_TEXT_ENTRY]?.load(
      junctions.map(row => row.id)
    )) as Array<{id: number}>;
    expect(loadedJunctions.map(row => row.id)).toEqual(
      junctions.map(row => row.id)
    );
    const loadedReuses = (await registry[TEXT_ENTRY_REUSED]?.load([
      reuse.id,
    ])) as Array<{id: number}>;
    expect(loadedReuses.map(row => row.id)).toEqual([reuse.id]);
  });
});
