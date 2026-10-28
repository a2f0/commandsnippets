import {describe, expect, it} from 'vitest';
import {type Base, json, setUpBase, tagsOf} from '../helpers';

// A tag's name is a CharField, which takes a number as its string: a create
// naming one is a create of that name, answered with the user's tag of it
// when they have one, as a string name is.
describe('tag create with a numeric name', () => {
  const create = (client: Base['user1Client'], name: number | string) =>
    client.post('/api/v1/tags', {data: {type: 'Tag', attributes: {name}}});

  it('makes the tag of the number, then answers with it', async () => {
    const base = await setUpBase();
    const made = await create(base.user1Client, 42);
    expect(made.status).toBe(201);
    const {data} = await json(made);
    expect(data.attributes.name).toBe('42');

    for (const name of [42, '42', ' 42 ']) {
      const again = await create(base.user1Client, name);
      expect(again.status).toBe(200);
      expect((await json(again)).data.id).toBe(data.id);
    }
    const named = (await tagsOf(base.user1)).filter(tag => tag.name === '42');
    expect(named).toHaveLength(1);
  });

  it("answers with the user's tag of the number's name", async () => {
    const base = await setUpBase();
    const made = await create(base.user1Client, '7');
    expect(made.status).toBe(201);
    const id = (await json(made)).data.id;

    const again = await create(base.user1Client, 7);
    expect(again.status).toBe(200);
    expect((await json(again)).data.id).toBe(id);
  });
});
