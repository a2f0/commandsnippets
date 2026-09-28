import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {tags, tagsEntries} from '../../src/db/schema';
import {
  db,
  refreshEntry,
  refreshJunction,
  refreshTag,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
} from '../helpers';
import {failureOf} from '../support/errors';

// Django origin: backend/tearleads/tags/tests/test_tags_model.py
describe('TestTagsModel', () => {
  it('test_deleting_tag_deletes_junction_and_leaves_entry_and_updates_tag_count', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    let textEntry = await textEntryFactory({user: user1});
    const tagTextEntry = await tagTextEntryFactory({
      user: user1,
      tag,
      text_entry: textEntry,
    });
    textEntry = (await refreshEntry(textEntry.id)) ?? textEntry;
    await db().delete(tags).where(eq(tags.id, tag.id));
    expect(textEntry.tag_count).toBe(1);
    // Tag.DoesNotExist / TagTextEntryThroughModel.DoesNotExist
    expect(await refreshTag(tag.id)).toBeUndefined();
    expect(await refreshJunction(tagTextEntry.id)).toBeUndefined();
    // The cascade delete fires the junction's delete trigger.
    expect((await refreshEntry(textEntry.id))?.tag_count).toBe(0);
  });

  it('test_date_last_used', async () => {
    const {user1} = await setUpBase();
    let tag = await tagFactory({user: user1});
    // date_last_used should be close to date_created (within 1 second)
    const timeDiff = Math.abs(
      Date.parse(`${tag.date_last_used}Z`) - Date.parse(`${tag.date_created}Z`)
    );
    expect(timeDiff).toBeLessThan(1000);
    const textEntry = await textEntryFactory({user: user1});
    const tagTextEntry = await tagTextEntryFactory({
      user: user1,
      tag,
      text_entry: textEntry,
    });
    tag = (await refreshTag(tag.id)) ?? tag;
    expect(tag.date_last_used).not.toBeNull();
    expect(tag.date_last_used).toBe(tagTextEntry.date_created);
    await db().delete(tagsEntries).where(eq(tagsEntries.id, tagTextEntry.id));
    tag = (await refreshTag(tag.id)) ?? tag;
    // After deleting, date_last_used should be None as it was the last entry
    expect(tag.date_last_used).toBeNull();
  });

  it('test_entry_count', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    expect(tag.entry_count).toBe(0);
    const textEntry = await textEntryFactory({user: user1});
    const tagTextEntry = await tagTextEntryFactory({
      user: user1,
      tag,
      text_entry: textEntry,
    });
    expect((await refreshTag(tag.id))?.entry_count).toBe(1);
    await db().delete(tagsEntries).where(eq(tagsEntries.id, tagTextEntry.id));
    expect((await refreshTag(tag.id))?.entry_count).toBe(0);
  });

  // Django raised Postgres' DataError ("value too long for type character
  // varying(24)"); SQLite has no varchar limits, so a CHECK constraint
  // enforces the length instead.
  it('test_invalid_name_length', async () => {
    const {user1} = await setUpBase();
    const oversizedName = 'x'.repeat(24 + 1);
    expect(
      await failureOf(tagFactory({user: user1, name: oversizedName}))
    ).toMatch(/CHECK constraint failed: tags_tag_name_length/);
  });
});

// v2-specific behavior (no Django equivalent).
describe('TestTagsModel v2', () => {
  it('recomputes date_last_used from the most recent remaining junction', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const first = await tagTextEntryFactory({
      user: user1,
      tag,
      text_entry: await textEntryFactory({user: user1}),
    });
    const second = await tagTextEntryFactory({
      user: user1,
      tag,
      text_entry: await textEntryFactory({user: user1}),
      order: 1,
    });
    expect((await refreshTag(tag.id))?.date_last_used).toBe(
      second.date_created
    );
    await db().delete(tagsEntries).where(eq(tagsEntries.id, second.id));
    const after = await refreshTag(tag.id);
    expect(after?.date_last_used).toBe(first.date_created);
    expect(after?.entry_count).toBe(1);
  });

  it('enforces one tag name per user', async () => {
    const {user1, user2} = await setUpBase();
    await tagFactory({user: user1, name: 'shared'});
    // Same name for another user is fine.
    await tagFactory({user: user2, name: 'shared'});
    expect(await failureOf(tagFactory({user: user1, name: 'shared'}))).toMatch(
      /UNIQUE constraint failed/
    );
  });
});
