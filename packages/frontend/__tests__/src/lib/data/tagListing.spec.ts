import type {Tag} from '@commandsnippets/api-shared/responses';
import invariant from 'invariant';
import type {TagCounts} from '../../../../src/lib/data/tagEntryCounts';
import {
  type TagListing,
  type TagListingInput,
  tagListingOf,
} from '../../../../src/lib/data/tagListing';
import {tag} from '../../../util/storeFixtures';

const session = {};
const other = {};
// By their own counts git leads; by shortcuts vim does.
const tags: Tag[] = [
  tag('1', {name: 'git', entry_count: 9}),
  tag('2', {name: 'vim', entry_count: 5}),
];
const shortcuts = new Map([['2', 4]]);

const all: TagCounts = {status: 'all'};
const reading: TagCounts = {status: 'reading', kind: 'shortcut'};
const read: TagCounts = {status: 'read', kind: 'shortcut', counts: shortcuts};

const input = (
  counts: TagCounts,
  overrides: Partial<TagListingInput> = {}
): TagListingInput => ({
  tags,
  counts,
  order: '-entry_count',
  search: '',
  session,
  ...overrides,
});

const unread: TagListing = {status: 'unread'};
const listedAll: TagListing & {status: 'listed'} = {
  status: 'listed',
  tags,
  entryCounts: null,
  session,
};

/** A listing's status, its tags' names, and the counts it shows. */
const summary = (listing: TagListing) =>
  listing.status === 'unread'
    ? {status: listing.status}
    : {
        status: listing.status,
        names: listing.tags.map(({attributes}) => attributes.name),
        entryCounts: listing.entryCounts,
      };

describe('tagListingOf', () => {
  it.each<[string, TagListingInput, TagListing, ReturnType<typeof summary>]>([
    ['tags unread', input(all, {tags: undefined}), unread, {status: 'unread'}],
    [
      'every kind: by their own counts',
      input(all),
      unread,
      {status: 'listed', names: ['git', 'vim'], entryCounts: null},
    ],
    [
      'one kind read: by its counts',
      input(read),
      unread,
      {status: 'listed', names: ['vim', 'git'], entryCounts: shortcuts},
    ],
    [
      'one kind being read, after a list: kept',
      input(reading),
      listedAll,
      {status: 'kept', names: ['git', 'vim'], entryCounts: null},
    ],
    [
      'still being read: still kept',
      input(reading),
      {...listedAll, status: 'kept'},
      {status: 'kept', names: ['git', 'vim'], entryCounts: null},
    ],
    [
      "being read, after another session's list: unread",
      input(reading, {session: other}),
      listedAll,
      {status: 'unread'},
    ],
    [
      'being read, with nothing listed yet: unread',
      input(reading),
      unread,
      {status: 'unread'},
    ],
  ])('%s', (_case, made, last, expected) => {
    expect(summary(tagListingOf(made, last))).toEqual(expected);
  });

  it('keeps the list itself while counts are read', () => {
    const kept = tagListingOf(input(reading), listedAll);
    invariant(kept.status === 'kept', 'the list is kept');
    expect(kept.tags).toBe(tags);
    expect(tagListingOf(input(reading), kept)).toBe(kept);
  });
});
