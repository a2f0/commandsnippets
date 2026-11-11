import {Dexie} from 'dexie';
import invariant from 'invariant';
import {vi} from 'vitest';
import {DataVersionChangedError} from '../../../../src/lib/api/errors';
import {
  captureTagRenameIdentity,
  isCurrentTagRename,
} from '../../../../src/lib/data/tagRename';
import {createTag, renameTag} from '../../../../src/lib/data/writes';
import {
  AccountChangedError,
  bindOwner,
} from '../../../../src/lib/sync/accountBinding';
import {remap} from '../../../../src/lib/sync/adopt';
import {adoptVersion} from '../../../../src/lib/sync/dataVersion';
import {claimData, syncSession} from '../../../../src/lib/sync/session';
import {signIn, TEST_USER} from '../../../util/signIn';
import {testUser} from '../../../util/storeFixtures';

beforeEach(() => signIn());

async function localTag(bound = true) {
  const session = syncSession(TEST_USER);
  vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
  if (bound) await claimData(TEST_USER, testUser.id);
  const object = await createTag(session, 'first local tag');
  expect(object.relationships.user.data.id).toBe('');
  const identity = await captureTagRenameIdentity(session);
  return {session, object, identity};
}

it.each([false, true])(
  'follows a local rename with captured binding %s',
  async bound => {
    const {session, object, identity} = await localTag(bound);
    const renamed = await renameTag(session, object.id, 'renamed', identity);
    invariant(renamed, 'the tag was renamed');
    expect(identity.accountId).toBe(bound ? testUser.id : undefined);
    expect(await isCurrentTagRename(session, renamed, identity)).toBe(true);
    expect(await isCurrentTagRename(session, renamed, undefined)).toBe(false);
  }
);

it.each(['before', 'after'])(
  'follows a local id remapped %s persistence',
  async when => {
    const {session, object, identity} = await localTag();
    const rekey = () =>
      session.db.transaction(
        'rw',
        [session.db.tags, session.db.junctions, session.db.outbox],
        async () => {
          await remap(session.db, {
            owner: TEST_USER,
            type: 'Tag',
            from: object.id,
            to: '101',
          });
          await session.db.tags.update([TEST_USER, '101'], {
            relationships: {user: {data: {type: 'User', id: testUser.id}}},
          });
        }
      );
    if (when === 'before') await rekey();
    const renamed = await renameTag(session, object.id, 'renamed', identity);
    invariant(renamed, 'the tag was renamed');
    if (when === 'after') await rekey();
    expect(await isCurrentTagRename(session, renamed, identity)).toBe(true);
    expect(await session.db.tags.get([TEST_USER, object.id])).toBeUndefined();
    expect(
      (await session.db.tags.get([TEST_USER, '101']))?.attributes.name
    ).toBe('renamed');
    expect(
      (await session.db.outbox.toArray()).map(row => row.write)
    ).toContainEqual({kind: 'renameTag', tagId: '101', name: 'renamed'});
  }
);

it.each(['renamed again', 'deleted', 'missing', 'foreign row'])(
  'does not follow a stored rename when its row is %s',
  async change => {
    const {session, object, identity} = await localTag();
    const renamed = await renameTag(session, object.id, 'renamed', identity);
    invariant(renamed, 'the tag was renamed');
    if (change === 'renamed again')
      await renameTag(session, object.id, 'newer');
    else if (change === 'deleted')
      await session.db.tags.update([TEST_USER, object.id], {
        'attributes.is_deleted': true,
      });
    else if (change === 'missing')
      await session.db.tags.delete([TEST_USER, object.id]);
    else
      await session.db.tags.update([TEST_USER, object.id], {
        relationships: {user: {data: {type: 'User', id: 'foreign'}}},
      });
    expect(await isCurrentTagRename(session, renamed, identity)).toBe(false);
  }
);

it.each(['before', 'after'])(
  'guards a replacement account %s persistence with the same id and name',
  async when => {
    const {session, object, identity} = await localTag();
    const renamed =
      when === 'after'
        ? await renameTag(session, object.id, 'renamed', identity)
        : null;
    await claimData(TEST_USER, 'replacement-account');
    const replacement = {
      ...object,
      owner: TEST_USER,
      attributes: {
        ...object.attributes,
        name: when === 'after' ? 'renamed' : 'replacement',
      },
      relationships: {
        user: {
          data: {...object.relationships.user.data, id: 'replacement-account'},
        },
      },
    };
    await session.db.tags.put(replacement);
    if (when === 'before') {
      await expect(
        renameTag(session, object.id, 'renamed', identity)
      ).rejects.toBeInstanceOf(AccountChangedError);
    } else {
      invariant(renamed, 'the old tag was renamed');
      expect(await isCurrentTagRename(session, renamed, identity)).toBe(false);
    }
    expect(await session.db.tags.get([TEST_USER, object.id])).toEqual(
      replacement
    );
    expect(await session.db.outbox.count()).toBe(0);
  }
);

it.each(['before', 'after'])(
  'guards a replacement data version %s persistence',
  async when => {
    const {session, object} = await localTag();
    await adoptVersion(session.db, TEST_USER, 1);
    const identity = await captureTagRenameIdentity(session);
    const renamed =
      when === 'after'
        ? await renameTag(session, object.id, 'renamed', identity)
        : null;
    await adoptVersion(session.db, TEST_USER, 2);
    const replacement = {
      ...object,
      owner: TEST_USER,
      attributes: {
        ...object.attributes,
        name: when === 'after' ? 'renamed' : 'replacement',
      },
    };
    await session.db.tags.put(replacement);
    if (when === 'before') {
      await expect(
        renameTag(session, object.id, 'renamed', identity)
      ).rejects.toBeInstanceOf(DataVersionChangedError);
    } else {
      invariant(renamed, 'the old tag was renamed');
      expect(await isCurrentTagRename(session, renamed, identity)).toBe(false);
    }
    expect(await session.db.tags.get([TEST_USER, object.id])).toEqual(
      replacement
    );
    expect(await session.db.outbox.count()).toBe(0);
  }
);

it.each(['before', 'after'])(
  'keeps a local rename across first version adoption %s persistence',
  async when => {
    const {session, object, identity} = await localTag();
    expect(identity.version).toBeUndefined();
    if (when === 'before') await adoptVersion(session.db, TEST_USER, 1);
    const renamed = await renameTag(session, object.id, 'renamed', identity);
    invariant(renamed, 'the local tag was renamed');
    if (when === 'after') await adoptVersion(session.db, TEST_USER, 1);
    expect(await isCurrentTagRename(session, renamed, identity)).toBe(true);
    expect((await session.db.outbox.toArray()).map(row => row.version)).toEqual(
      [1, 1]
    );
  }
);

it.each(['before', 'after'])(
  'requires a fresh capture when an unknown account is bound %s persistence',
  async when => {
    const {session, object, identity} = await localTag(false);
    const renamed =
      when === 'after'
        ? await renameTag(session, object.id, 'renamed', identity)
        : null;
    await claimData(TEST_USER, testUser.id);
    if (when === 'before') {
      await expect(
        renameTag(session, object.id, 'renamed', identity)
      ).rejects.toBeInstanceOf(AccountChangedError);
    } else {
      invariant(renamed, 'the tag was already stored');
      expect(await isCurrentTagRename(session, renamed, identity)).toBe(false);
    }
    // Refusal loses neither the retained local row nor the ability to retry.
    expect(
      (await session.db.tags.get([TEST_USER, object.id]))?.attributes.name
    ).toBe(when === 'before' ? 'first local tag' : 'renamed');
    const retryIdentity = await captureTagRenameIdentity(session);
    const retried = await renameTag(
      session,
      object.id,
      'retried',
      retryIdentity
    );
    invariant(retried, 'the fresh attempt was stored');
    expect(await isCurrentTagRename(session, retried, retryIdentity)).toBe(
      true
    );
  }
);

it('does not treat an unavailable identity read as an unbound snapshot', async () => {
  const {session, object} = await localTag(false);
  vi.spyOn(session.db, 'transaction').mockRejectedValueOnce(
    new Error('identity unavailable')
  );
  await expect(captureTagRenameIdentity(session)).rejects.toThrow(
    'identity unavailable'
  );
  expect(await isCurrentTagRename(session, object, undefined)).toBe(false);
  expect(
    (await session.db.tags.get([TEST_USER, object.id]))?.attributes.name
  ).toBe('first local tag');
});

it('finishes a valid transaction before an account replacement can enter it', async () => {
  const {session, object, identity} = await localTag();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const put = session.db.tags.put.bind(session.db.tags);
  vi.spyOn(session.db.tags, 'put').mockImplementationOnce((...args) => {
    entered.resolve();
    return Dexie.Promise.resolve(Dexie.waitFor(resume.promise)).then(() =>
      put(...args)
    );
  });
  const saving = renameTag(session, object.id, 'renamed', identity);
  await entered.promise;
  // A competing tab/session has its own transaction, not Dexie's ambient
  // transaction context propagated through the test's entered promise.
  const replacing = Dexie.ignoreTransaction(() =>
    bindOwner(session.db, TEST_USER, 'replacement-account')
  );
  resume.resolve();
  const renamed = await saving;
  invariant(renamed, 'the validly started write completed');
  expect(renamed.attributes.name).toBe('renamed');
  await replacing;
  expect(await session.db.tags.count()).toBe(0);
  expect(await session.db.outbox.count()).toBe(0);
  expect(await isCurrentTagRename(session, renamed, identity)).toBe(false);
});
