import {describe, expect, it} from 'vitest';
import {json, setUpBase, textEntryFactory} from '../helpers';

type Row = {id: string};

// Django's icontains ran on Postgres, whose UPPER() is Unicode-aware; SQLite's
// LIKE folds ASCII only, so search goes through folded copies of the text.
describe('Unicode-aware search', () => {
  const search = async (
    client: Awaited<ReturnType<typeof setUpBase>>['user1Client'],
    term: string
  ) =>
    (
      (
        await json(
          await client.get(
            `/api/v1/entries?filter[search]=${encodeURIComponent(term)}`
          )
        )
      ).data as Row[]
    ).map(row => row.id);

  it('matches non-ASCII text regardless of case, in subject and body', async () => {
    const {user1, user1Client} = await setUpBase();
    const entry = await textEntryFactory({
      user: user1,
      subject: 'Über den Wolken',
      body: 'Ça va',
    });
    for (const term of ['über', 'ÜBER', 'Über', 'ça', 'ÇA VA', 'wolken']) {
      expect(await search(user1Client, term)).toEqual([String(entry.id)]);
    }
    expect(await search(user1Client, 'uber')).toEqual([]);
  });

  it('keeps the folded text current when an entry is edited', async () => {
    const {user1, user1Client} = await setUpBase();
    const entry = await textEntryFactory({
      user: user1,
      subject: 'Über den Wolken',
      body: 'first body',
    });
    const patch = (attributes: object) =>
      user1Client.patch(`/api/v1/entries/${entry.id}`, {
        data: {type: 'TextEntry', id: String(entry.id), attributes},
      });

    expect((await patch({subject: 'Neue Überschrift'})).status).toBe(200);
    expect(await search(user1Client, 'ÜBERSCHRIFT')).toEqual([
      String(entry.id),
    ]);
    expect(await search(user1Client, 'wolken')).toEqual([]);

    // Editing only the body keeps the subject's fold.
    expect((await patch({body: 'Zweiter Körper'})).status).toBe(200);
    expect(await search(user1Client, 'körper')).toEqual([String(entry.id)]);
    expect(await search(user1Client, 'überschrift')).toEqual([
      String(entry.id),
    ]);
  });

  it('folds entries created through the API', async () => {
    const {user1Client} = await setUpBase();
    const created = await json(
      await user1Client.post('/api/v1/entries', {
        data: {
          type: 'TextEntry',
          attributes: {subject: 'Ärger', body: 'x'},
        },
      })
    );
    expect(await search(user1Client, 'ärger')).toEqual([created.data.id]);
  });
});
