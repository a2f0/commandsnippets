import {describe, expect, it} from 'vitest';
import {json, setUpBase} from '../helpers';

describe('include paths over the API', () => {
  it('rejects cyclic include paths past the depth limit', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.get(
      '/api/v1/entries?include=text_entry_to_tag.text_entry.text_entry_to_tag.text_entry'
    );
    expect(response.status).toBe(400);
    expect((await json(response)).errors[0].detail).toContain(
      'deeper than 3 relationships'
    );
  });

  it('serves a depth-3 cyclic path without duplicate resources', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.get(
      '/api/v1/entries?include=text_entry_to_tag.text_entry.text_entry_to_tag'
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    const keys = (body.included as Array<{type: string; id: string}>).map(
      r => `${r.type}:${r.id}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
