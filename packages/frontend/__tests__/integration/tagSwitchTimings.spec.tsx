/** A tag switch, timed for the HUD from the click to its entries' paint. */
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import * as timings from '../../src/lib/metrics/timings';
import {
  clearMetrics,
  type Interaction,
  metricsSnapshot,
  timingsOf,
} from '../../src/lib/metrics/timings';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});
afterEach(() => vi.restoreAllMocks());

/**
 * Each list the entry list says it shows (`listShown`), with the entries
 * on the page then.
 */
function watchListsShown(): Array<{target: string; entries: number}> {
  const shown: Array<{target: string; entries: number}> = [];
  const listShown = timings.listShown;
  vi.spyOn(timings, 'listShown').mockImplementation(target => {
    shown.push({target, entries: screen.queryAllByRole('entry').length});
    listShown(target);
  });
  return shown;
}

/** The tag switch to `tag`, once painted. */
const paintedSwitch = (tag: string) =>
  waitFor(
    () => {
      const interaction = metricsSnapshot().interactions.find(
        ({target}) => target === `tag:${tag}`
      );
      expect(interaction?.painted).toEqual(expect.any(Number));
      invariant(interaction, 'the switch is timed');
      return interaction;
    },
    {timeout: 3000}
  );

/** Click the tag named `name` in the tag list. */
async function clickTag(name: string) {
  const label = await screen.findByText(name);
  const tag = label.closest('[role="tag"]');
  invariant(tag, `${name} is in the tag list`);
  fireEvent.click(tag);
}

describe('Switching tags', () => {
  it('is timed from the click to the paint of the new tag’s entries', async () => {
    const history = createMemoryHistory();
    // Tag 2 has no entries; tag 1 has some.
    history.push('/test/test-tag-2');
    render(<TestAppRouter history={history} />);
    await screen.findByText('test-tag-1');
    await waitFor(() => expect(screen.queryAllByRole('entry')).toHaveLength(0));
    clearMetrics();
    const listsShown = watchListsShown();

    await clickTag('test-tag-1');

    const interaction: Interaction = await paintedSwitch('test-tag-1');
    expect(interaction.name).toBe('tag switch');
    const rows = screen.getAllByRole('entry').length;
    expect(rows).toBeGreaterThan(0);
    const during = timingsOf(metricsSnapshot(), interaction).filter(
      ({start}) => start <= (interaction.painted ?? 0)
    );
    const names = during.map(({kind, name}) => `${kind} ${name}`);
    expect(names).toEqual(
      expect.arrayContaining([
        'idb useTagNamed',
        'idb useTagEntries',
        'render EntryList',
      ])
    );
    expect(
      during.filter(({name}) => name === 'EntryList').map(({detail}) => detail)
    ).toContain(`${rows} rows`);
    // Shown (the clock stops at the next paint) only with the new tag's
    // rows, not the last tag's (none), which its query answered with until
    // it read the new ones.
    expect(listsShown.find(({target}) => target === 'tag:test-tag-1')).toEqual({
      target: 'tag:test-tag-1',
      entries: rows,
    });
  });

  it('from all the entries, is timed to the paint of the tag’s own', async () => {
    const history = createMemoryHistory();
    history.push('/test?entries=all');
    render(<TestAppRouter history={history} />);
    await screen.findByText('test-tag-1');
    await waitFor(() =>
      expect(screen.queryAllByRole('entry').length).toBeGreaterThan(0)
    );
    clearMetrics();
    const listsShown = watchListsShown();

    await clickTag('test-tag-1');

    await paintedSwitch('test-tag-1');
    await waitFor(() =>
      expect(history.location.pathname).toBe('/test/test-tag-1')
    );
    const rows = screen.getAllByRole('entry').length;
    expect(rows).toBeGreaterThan(0);
    // Not with no rows, while its tag was still being read (the tag query
    // answering with the last list's, none): with the tag's own.
    expect(listsShown.find(({target}) => target === 'tag:test-tag-1')).toEqual({
      target: 'tag:test-tag-1',
      entries: rows,
    });
  });
});
