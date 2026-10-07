import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {entryReuses, tagsEntries} from '../../src/db/schema';
import {
  db,
  json,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  textEntryReusedFactory,
} from '../helpers';
import {failureOf} from '../support/errors';

// v2: a tagging belongs to its tag's user and its entry's, and a reuse to its
// entry's (migrations/0021_own_links.sql). No row links one user's data to
// another's, so none can leak through `include` or a filter.
describe("a link between two users' rows", () => {
  it("is refused as a tagging of another user's tag or entry", async () => {
    const {user1, user2} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const theirTag = await tagFactory({user: user2});
    const theirEntry = await textEntryFactory({user: user2});

    for (const fields of [
      {tag: theirTag, text_entry: entry, user: user1},
      {tag, text_entry: theirEntry, user: user1},
      {tag, text_entry: entry, user: user2},
    ]) {
      expect(await failureOf(tagTextEntryFactory(fields))).toMatch(
        'cross_user_link'
      );
    }
    // The user's own tagging is made.
    expect(
      (await tagTextEntryFactory({tag, text_entry: entry, user: user1})).id
    ).toBeGreaterThan(0);
  });

  it('is refused when a tagging is moved to another user', async () => {
    const {user1, user2} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const junction = await tagTextEntryFactory({
      tag,
      text_entry: entry,
      user: user1,
    });
    const theirTag = await tagFactory({user: user2});

    for (const set of [{user_id: user2.id}, {tag_id: theirTag.id}]) {
      expect(
        await failureOf(
          db()
            .update(tagsEntries)
            .set(set)
            .where(eq(tagsEntries.id, junction.id))
        )
      ).toMatch('cross_user_link');
    }
  });

  it("is refused as a reuse of another user's entry", async () => {
    const {user1, user2} = await setUpBase();
    const theirEntry = await textEntryFactory({user: user2});
    expect(
      await failureOf(
        textEntryReusedFactory({text_entry: theirEntry, user: user1})
      )
    ).toMatch('cross_user_link');

    const entry = await textEntryFactory({user: user1});
    const reuse = await textEntryReusedFactory({
      text_entry: entry,
      user: user1,
    });
    expect(
      await failureOf(
        db()
          .update(entryReuses)
          .set({text_entry_id: theirEntry.id})
          .where(eq(entryReuses.id, reuse.id))
      )
    ).toMatch('cross_user_link');
  });
});

describe('filters by tag', () => {
  it("do not match entries by another user's tag", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    await textEntryFactory({user: user1});
    const theirTag = await tagFactory({user: user2, name: 'their-tag'});
    const theirEntry = await textEntryFactory({user: user2});
    await tagTextEntryFactory({
      tag: theirTag,
      text_entry: theirEntry,
      user: user2,
    });

    for (const filter of [
      'filter[tags.name]=their-tag',
      `filter[tags.id]=${theirTag.id}`,
    ]) {
      const response = await user1Client.get(`/api/v1/entries?${filter}`);
      expect(response.status).toBe(200);
      expect((await json(response)).data).toEqual([]);
    }
  });

  it("still match the requester's own tags", async () => {
    const {user1, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    const tag = await tagFactory({user: user1, name: 'mine'});
    await tagTextEntryFactory({tag, text_entry: entry, user: user1});
    const response = await user1Client.get(
      '/api/v1/entries?filter[tags.name]=mine'
    );
    expect((await json(response)).data.map((r: {id: string}) => r.id)).toEqual([
      String(entry.id),
    ]);
  });
});
