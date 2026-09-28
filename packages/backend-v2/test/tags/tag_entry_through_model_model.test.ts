import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {tagsEntries} from '../../src/db/schema';
import {
  db,
  refreshEntry,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
} from '../helpers';
import {failureOf} from '../support/errors';

// Django origin: backend/tearleads/tags/tests/test_tag_entry_through_model_model.py
describe('TestTagsEntriesModel', () => {
  it('test_tag_count', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const textEntry = await textEntryFactory({user: user1});
    const tagTextEntry = await tagTextEntryFactory({
      user: user1,
      tag,
      text_entry: textEntry,
    });
    expect((await refreshEntry(textEntry.id))?.tag_count).toBe(1);
    await db().delete(tagsEntries).where(eq(tagsEntries.id, tagTextEntry.id));
    expect((await refreshEntry(textEntry.id))?.tag_count).toBe(0);
  });
});

// v2-specific behavior (no Django equivalent).
describe('TestTagsEntriesModel v2', () => {
  it('allows one junction per (tag, text_entry)', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const textEntry = await textEntryFactory({user: user1});
    await tagTextEntryFactory({user: user1, tag, text_entry: textEntry});
    expect(
      await failureOf(
        tagTextEntryFactory({user: user1, tag, text_entry: textEntry, order: 1})
      )
    ).toMatch(/UNIQUE constraint failed/);
    expect((await refreshEntry(textEntry.id))?.tag_count).toBe(1);
  });

  it('rejects negative ranks', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const textEntry = await textEntryFactory({user: user1});
    expect(
      await failureOf(
        tagTextEntryFactory({
          user: user1,
          tag,
          text_entry: textEntry,
          order: -1,
        })
      )
    ).toMatch(
      /CHECK constraint failed: tags_tagtextentrythroughmodel_order_check/
    );
  });
});
