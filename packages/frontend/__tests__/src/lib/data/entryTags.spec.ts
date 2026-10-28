import {describe, expect, it} from 'vitest';

import {tagNamesByEntry} from '../../../../src/lib/data/entryTags';
import {tag} from '../../../util/storeFixtures';

const tags = [
  tag('1', {name: 'shell'}),
  tag('2', {name: 'Git'}),
  tag('3', {name: 'docker'}),
  tag('4', {name: 'old', is_deleted: true}),
];

const byEntry = new Map([
  ['10', ['1', '2', '3']],
  ['11', ['1']],
  ['12', ['1', '4']],
]);

describe('tagNamesByEntry', () => {
  it('names every tag of each entry, by name, on the all-entries list', () => {
    const names = tagNamesByEntry(byEntry, tags, undefined, new Map());

    expect(Object.fromEntries(names)).toEqual({
      '10': ['docker', 'Git', 'shell'],
      '11': ['shell'],
      // Not the deleted tag.
      '12': ['shell'],
    });
  });

  it('leaves out the tag the list shows, and entries with no other', () => {
    const names = tagNamesByEntry(byEntry, tags, '1', new Map());

    expect(Object.fromEntries(names)).toEqual({'10': ['docker', 'Git']});
  });

  it('keeps the arrays of entries whose names are unchanged', () => {
    const before = tagNamesByEntry(byEntry, tags, undefined, new Map());
    const renamed = tags.map(each =>
      each.id === '3'
        ? tag('3', {name: 'containers'})
        : tag(each.id, {...each.attributes, order: 99})
    );

    const after = tagNamesByEntry(byEntry, renamed, undefined, before);

    expect(after.get('11')).toBe(before.get('11'));
    expect(after.get('12')).toBe(before.get('12'));
    expect(after.get('10')).toEqual(['containers', 'Git', 'shell']);
  });
});
