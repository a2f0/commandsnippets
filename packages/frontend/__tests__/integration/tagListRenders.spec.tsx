/**
 * How often the tag list renders, and its rows: once for each list read
 * (none for a copy of it an effect sets afterwards), with the tag selected
 * highlighted from the first.
 */
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import {appMode} from '../../src/lib/shared';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {API, serveMockApi, server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {seed, tag} from '../util/storeFixtures';
import {renderAppAt} from '../util/TestAppRouter';

const renders = vi.hoisted(() => ({lists: 0, rows: 0}));

/** Whether the hook calling this was called by a component in `file`. */
const calledIn = (file: string) =>
  (new Error().stack ?? '').split('\n')[3]?.includes(`/tags/${file}:`) ?? false;

// The list's and its rows' renders, every one: each calls this hook once a
// render.
vi.mock('../../src/lib/data/hooks', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/lib/data/hooks')>();
  return {
    ...actual,
    useReadOnly: () => {
      if (calledIn('TagList.tsx')) {
        renders.lists += 1;
      } else if (calledIn('Tag.tsx')) {
        renders.rows += 1;
      }
      return actual.useReadOnly();
    },
  };
});

const COUNT = 20;
const WAIT = {timeout: 10_000};
vi.setConfig({testTimeout: 30_000});

serveMockApi();
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const highlighted = () =>
  screen
    .getAllByRole('tag')
    .filter(row => row.getAttribute('aria-current') === 'true')
    .map(row => row.id);

/** `COUNT` tags, as the database holds them, the third shown. */
async function showTags(): Promise<void> {
  await seed(
    Array.from({length: COUNT}, (_, i) =>
      tag(String(i + 1), {name: `name-${i + 1}`})
    )
  );
  // The list as the database holds it: no sync changes it meanwhile.
  server.use(http.all(`${API}/*`, () => HttpResponse.error()));
  renders.lists = 0;
  renders.rows = 0;
  renderAppAt('/test/name-3');
  await screen.findByText(`name-${COUNT}`, undefined, WAIT);
}

it('renders the list once for each list read, and each row once', async () => {
  await showTags();
  // Before the tags are read, as they are, and once the tag shown is
  // selected; and each row once, and the two whose highlight that moves.
  expect(renders.lists).toBeLessThanOrEqual(3);
  expect(renders.rows).toBeLessThanOrEqual(COUNT + 2);
  expect(highlighted()).toEqual(['tag-3']);

  renders.lists = 0;
  renders.rows = 0;
  // A search: the list as read again, the tags whose names match.
  act(() => store.setTagSearchString('name-1'));
  expect(screen.getAllByRole('tag')).toHaveLength(11);
  expect(renders.lists).toBe(1);
  expect(renders.rows).toBeLessThanOrEqual(11);
  // The tag selected is not listed: the first is highlighted.
  expect(highlighted()).toEqual(['tag-1']);
});

it('highlights the tag chosen with the arrow keys until the tag selected changes', async () => {
  await showTags();
  await waitFor(() => expect(highlighted()).toEqual(['tag-3']), WAIT);
  act(() => store.setAppMode(appMode.tagsList));

  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(highlighted()).toEqual(['tag-4']);
  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  fireEvent.keyDown(document, {key: 'ArrowUp', code: 'ArrowUp'});
  expect(highlighted()).toEqual(['tag-4']);

  // Another tag shown (Back, say): it is highlighted.
  act(() => store.setTagSelectedID('7'));
  expect(highlighted()).toEqual(['tag-7']);

  // A click on the tag shown highlights it again after the arrow keys.
  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  expect(highlighted()).toEqual(['tag-8']);
  fireEvent.click(screen.getByText('name-7'));
  expect(highlighted()).toEqual(['tag-7']);
});
