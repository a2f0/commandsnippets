import {describe, expect, it, vi} from 'vitest';
import {now} from '../../src/lib/clock';
import {ApiError} from '../../src/lib/errors';
import {OrderedModel, type OrderedRow} from '../../src/lib/ordered';
import {tagOrdering} from '../../src/resources/tags';
import {db, refreshTag, setUpBase, tagFactory, tagsOf} from '../helpers';

const row = (tag: {
  id: number;
  order: number;
  user_id: number;
}): OrderedRow => ({
  id: tag.id,
  order: tag.order,
  scope: tag.user_id,
});

// v2: src/lib/ordered.ts, the django-ordered-model port.
describe('OrderedModel', () => {
  const model = () => new OrderedModel(db(), tagOrdering);

  it('nextOrder is 0 for an empty scope and max + 1 otherwise', async () => {
    const {user1} = await setUpBase();
    expect(await model().nextOrder(999999)).toBe(0);
    // Example tags are ranked 1 and 2.
    expect(await model().nextOrder(user1.id)).toBe(3);
  });

  it('above is a no-op for rows with the same rank', async () => {
    const {user1} = await setUpBase();
    const a = await tagFactory({user: user1, order: 5});
    const b = await tagFactory({user: user1, order: 5});
    await model().above(row(a), row(b), now());
    expect(await refreshTag(a.id)).toEqual(a);
    expect(await refreshTag(b.id)).toEqual(b);
  });

  it('below moves a row directly after the reference, both directions', async () => {
    const {user1} = await setUpBase();
    const a = await tagFactory({user: user1, name: 'a', order: 10});
    const b = await tagFactory({user: user1, name: 'b', order: 11});
    const c = await tagFactory({user: user1, name: 'c', order: 12});
    const names = async () =>
      (await tagsOf(user1))
        .filter(tag => tag.order >= 10)
        .sort((x, y) => x.order - y.order)
        .map(tag => tag.name);

    // Down: a below b.
    await model().below(row(a), row(b), now());
    expect(await names()).toEqual(['b', 'a', 'c']);

    // Up: c below b (c is currently below a).
    const fresh = async (id: number) => row((await refreshTag(id)) as never);
    await model().below(await fresh(c.id), await fresh(b.id), now());
    expect(await names()).toEqual(['b', 'c', 'a']);

    // Already directly below the reference: a no-op.
    const d = await tagFactory({user: user1, name: 'd', order: 30});
    const e = await tagFactory({user: user1, name: 'e', order: 31});
    await model().below(row(e), row(d), now());
    expect((await refreshTag(e.id))?.order).toBe(31);
  });

  it('to() refuses to move a row whose rank changed since it was read', async () => {
    const {user1} = await setUpBase();
    const a = await tagFactory({user: user1, order: 10});
    const b = await tagFactory({user: user1, order: 11});
    const stale = {...row(a), order: 3};
    expect(await model().to(stale, 11, now())).toBe(false);
    expect(await refreshTag(a.id)).toEqual(a);
    expect(await refreshTag(b.id)).toEqual(b);
    // With the real rank it applies.
    expect(await model().to(row(a), 11, now())).toBe(true);
    expect((await refreshTag(a.id))?.order).toBe(11);
    expect((await refreshTag(b.id))?.order).toBe(10);
    // Moving to the current rank is a successful no-op.
    expect(await model().to({...row(b), order: 10}, 10, now())).toBe(true);
  });

  it('retries with fresh ranks when a concurrent move interferes', async () => {
    const {user1} = await setUpBase();
    const a = await tagFactory({user: user1, name: 'a', order: 10});
    const b = await tagFactory({user: user1, name: 'b', order: 11});
    // `a` is read with a stale rank; the first attempt fails, the retry
    // re-reads both rows and succeeds.
    await model().above({...row(b), order: 20}, row(a), now());
    expect((await refreshTag(b.id))?.order).toBe(10);
    expect((await refreshTag(a.id))?.order).toBe(11);
  });

  it('gives up with a 409 after repeated interference', async () => {
    const {user1} = await setUpBase();
    const a = await tagFactory({user: user1, order: 10});
    const b = await tagFactory({user: user1, order: 11});
    vi.spyOn(OrderedModel.prototype, 'to').mockResolvedValue(false);
    const error = await model()
      .above(row(b), row(a), now())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
  });

  it('404s when a moved row disappears', async () => {
    const {user1} = await setUpBase();
    const a = await tagFactory({user: user1, order: 10});
    const ghost = {id: 999999, order: 20, scope: user1.id};
    const error = await model()
      .above(ghost, row(a), now())
      .catch((caught: unknown) => caught);
    expect((error as ApiError).status).toBe(404);
  });

  it('refuses to order rows from different scopes', async () => {
    const {user1, user2} = await setUpBase();
    const a = await tagFactory({user: user1, order: 10});
    const b = await tagFactory({user: user2, order: 11});
    await expect(model().above(row(a), row(b), now())).rejects.toThrow(
      'Cannot order rows from different scopes'
    );
  });
});
