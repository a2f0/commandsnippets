import {beforeEach, describe, expect, it} from 'vitest';
import {type Base, setUpBase, textEntryFactory} from '../helpers';
import {errorMessages} from '../support/errors';

async function expectCheckFailure(
  promise: Promise<unknown>,
  constraint: string
) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  );
  expect(error).not.toBeNull();
  expect(errorMessages(error)).toContain(
    `CHECK constraint failed: ${constraint}`
  );
}

// Django origin: backend/tearleads/text_entries/tests/test_text_entries_model.py
// v2: Postgres raised DataError ("value too long for type character
// varying(N)"); SQLite has no varchar lengths, so CHECK constraints stand in.
describe('TestTextEntriesModel', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('test_invalid_body_length', async () => {
    const maxLength = 1024;
    await expectCheckFailure(
      textEntryFactory({user: base.user1, body: 'x'.repeat(maxLength + 1)}),
      'text_entries_textentry_body_length'
    );
    // The boundary itself is allowed.
    const entry = await textEntryFactory({
      user: base.user1,
      body: 'x'.repeat(maxLength),
    });
    expect(entry.body.length).toBe(maxLength);
  });

  it('test_invalid_subject_length', async () => {
    const maxLength = 255;
    await expectCheckFailure(
      textEntryFactory({user: base.user1, subject: 'x'.repeat(maxLength + 1)}),
      'text_entries_textentry_subject_length'
    );
    const entry = await textEntryFactory({
      user: base.user1,
      subject: 'x'.repeat(maxLength),
    });
    expect(entry.subject.length).toBe(maxLength);
  });
});
