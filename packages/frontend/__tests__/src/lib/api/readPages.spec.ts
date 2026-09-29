import type {TagListDocument} from '@commandsnippets/api-shared';
import invariant from 'invariant';
import {describe, expect, it} from 'vitest';

import {readPages} from '../../../../src/lib/api/readPages';
import {pagination} from '../../../../src/msw/documents';
import {tagsResponse} from '../../../../test/mocks/tags/tagsResponse';

const URL = 'http://localhost:9001/api/v1/tags';
const [tag1, tag2, tag3] = tagsResponse.data;
const user = tagsResponse.included?.[0];
invariant(
  tag1 && tag2 && tag3 && user,
  'the fixture has three tags and a user'
);
const included = [user];

/** Page `page` of `pages`, of a list of `count`, holding `data`. */
function page(
  number: number,
  pages: number,
  count: number,
  data: TagListDocument['data']
): TagListDocument {
  return {...pagination(URL, number, pages, count), data, included};
}

/** Answer each read with the next of `answers`, recording the pages asked. */
function answering(answers: TagListDocument[]) {
  const asked: number[] = [];
  const read = (number: number) => {
    asked.push(number);
    const answer = answers[asked.length - 1];
    invariant(answer, `no answer for read ${asked.length}`);
    return Promise.resolve(answer);
  };
  return {asked, read};
}

describe('readPages', () => {
  it('reads every page, in order, with what each includes', async () => {
    const {asked, read} = answering([
      page(1, 2, 3, [tag1, tag2]),
      page(2, 2, 3, [tag3]),
    ]);
    expect(await readPages(read)).toEqual([tag1, tag2, user, tag3, user]);
    expect(asked).toEqual([1, 2]);
  });

  it('reads the list again when a row is read twice', async () => {
    // Tag 1 changed after page 1: it moved to the end, and tag 3 moved
    // onto page 1, which was read already.
    const moved = {
      ...tag1,
      attributes: {...tag1.attributes, date_updated: '2030-01-01T00:00:00'},
    };
    const {asked, read} = answering([
      page(1, 2, 3, [tag1, tag2]),
      page(2, 2, 3, [moved]),
      page(1, 2, 3, [tag2, tag3]),
      page(2, 2, 3, [moved]),
    ]);
    expect(await readPages(read)).toEqual([tag2, tag3, user, moved, user]);
    expect(asked).toEqual([1, 2, 1, 2]);
  });

  it('reads the list again when its total changes between pages', async () => {
    // A row left the list after page 1: the rows after it moved up one.
    const {asked, read} = answering([
      page(1, 2, 3, [tag1, tag2]),
      page(2, 2, 2, []),
      page(1, 1, 2, [tag1, tag3]),
    ]);
    expect(await readPages(read)).toEqual([tag1, tag3, user]);
    expect(asked).toEqual([1, 2, 1]);
  });

  it('fails when the list changes on every read', async () => {
    const shifting = [page(1, 2, 3, [tag1, tag2]), page(2, 2, 3, [tag1])];
    const {asked, read} = answering([...shifting, ...shifting, ...shifting]);
    await expect(readPages(read)).rejects.toThrow(
      'The list changed on every read of its pages'
    );
    expect(asked).toEqual([1, 2, 1, 2, 1, 2]);
  });
});
