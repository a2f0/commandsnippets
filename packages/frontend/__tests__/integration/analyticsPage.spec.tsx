import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import {recentRange} from '../../src/components/analytics/buckets';
import {apiClient} from '../../src/lib/api/apiClient';
import {DataVersionChangedError} from '../../src/lib/api/errors';
import {readAnalytics} from '../../src/lib/data/analytics';
import {routeOf} from '../../src/lib/router/route';
import {syncSession} from '../../src/lib/sync/session';
import {setRuntimeEntriesOverride} from '../../src/msw/handlers';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {apiClientMethods} from '../util/apiClientMethods';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi, server} from '../util/msw';
import {signIn} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1/user/analytics';
serveMockApi();
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function mount(path = '/test/activity/analytics', signedIn = true) {
  if (signedIn) {
    signIn();
    assignLoggedInCookie();
  }
  return renderAppAt(path).history;
}

async function select(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', {name: label}));
  fireEvent.click(await screen.findByRole('option', {name: option}));
}

it('opens from View and slices actual reuses by dates and tag, with exact chart values', async () => {
  mount('/test?entries=all');
  await apiClient.forVersion(1).reuseEntry('1', 'analytics-1');
  await apiClient.forVersion(1).reuseEntry('1', 'analytics-2');
  fireEvent.click(screen.getByRole('menu', {name: 'View'}));
  fireEvent.click(await screen.findByText('Analytics'));
  await screen.findByRole('heading', {name: 'Analytics'});
  await select('Date to analyze', 'Entries reused');
  const chart = await screen.findByRole('img', {name: /Activity over time/});
  expect(chart).toHaveTextContent('2 events');
  fireEvent.click(screen.getByRole('button', {name: 'Show chart data'}));
  expect(
    await screen.findByRole('table', {name: 'Activity over time'})
  ).toHaveTextContent('2');
  const tags = screen.getByRole('list', {name: 'Top tags'});
  fireEvent.click(within(tags).getAllByRole('button')[0] as HTMLElement);
  await waitFor(() =>
    expect(screen.getByRole('combobox', {name: 'Tag'})).not.toHaveTextContent(
      'All tags'
    )
  );
  await screen.findByRole('img', {name: /Activity over time/});
  fireEvent.change(screen.getByLabelText('From'), {
    target: {value: '2024-01-01'},
  });
  fireEvent.change(screen.getByLabelText('Through'), {
    target: {value: '2024-01-02'},
  });
  expect(
    await screen.findByText(/No activity in this slice/)
  ).toBeInTheDocument();
});

it('does not fetch invalid ranges, and clears old charts on filter changes and failures', async () => {
  mount();
  await screen.findByText(/No activity in this slice/);
  const reads = vi.spyOn(apiClientMethods, 'getAnalytics');
  fireEvent.change(screen.getByLabelText('From'), {
    target: {value: '2099-01-01'},
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Choose valid dates');
  expect(reads).not.toHaveBeenCalled();
  server.use(http.get(API, () => HttpResponse.error()));
  fireEvent.click(screen.getByRole('button', {name: 'Last 30 days'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load analytics'
  );
  expect(screen.queryByText(/No activity in this slice/)).toBeNull();
  server.resetHandlers();
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  expect(
    await screen.findByText(/No activity in this slice/)
  ).toBeInTheDocument();
});

it('shows all retained history, preserves filters and links, and returns to custom ranges', async () => {
  const entries = structuredClone(entriesResponse);
  for (const entry of entries.data)
    entry.attributes.date_created = '2001-02-03T12:00:00.000000';
  setRuntimeEntriesOverride(entries);
  const history = mount('/test/activity/analytics?activity=created&tag=1');
  await screen.findByText(/No activity in this slice/);
  fireEvent.click(screen.getByRole('button', {name: 'All time'}));
  expect(
    await screen.findByRole('img', {name: /Activity over time/})
  ).toHaveTextContent('4 events');
  expect(screen.getByRole('button', {name: 'All time'})).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('combobox', {name: 'Group by'})).toHaveTextContent(
    'Month'
  );
  const params = new URLSearchParams(history.location.search);
  expect(Object.fromEntries(params)).toMatchObject({
    activity: 'created',
    tag: '1',
    from: 'all',
    interval: 'month',
  });
  expect(params.get('to')).toBe(recentRange(1).to);
  fireEvent.click(screen.getByRole('button', {name: 'Show chart data'}));
  expect(
    await screen.findByRole('table', {name: 'Activity over time'})
  ).toHaveTextContent('Feb 1, 2001');
  const before = history.location.pathname + history.location.search;
  const entryLink = within(
    screen.getByRole('list', {name: 'Top entries'})
  ).getAllByRole('link')[0];
  invariant(entryLink, 'Missing ranked entry');
  fireEvent.click(entryLink);
  fireEvent.click(await screen.findByRole('link', {name: 'Back to analytics'}));
  await screen.findByRole('img', {name: /Activity over time/});
  expect(history.location.pathname + history.location.search).toBe(before);
  fireEvent.change(screen.getByLabelText('From'), {
    target: {value: recentRange(30).from},
  });
  await screen.findByText(/No activity in this slice/);
  expect(screen.getByRole('button', {name: 'All time'})).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  fireEvent.click(screen.getByRole('button', {name: 'All time'}));
  await screen.findByRole('img', {name: /Activity over time/});
  fireEvent.click(screen.getByRole('button', {name: 'Last 30 days'}));
  await screen.findByText(/No activity in this slice/);
  expect(new URLSearchParams(history.location.search).get('from')).toBe(
    recentRange(30).from
  );
});

it('labels combined daily periods in the chart and exact data table', async () => {
  const entries = structuredClone(entriesResponse);
  for (const entry of entries.data)
    entry.attributes.date_created = '2000-01-01T12:00:00.000000';
  setRuntimeEntriesOverride(entries);
  mount('/test/activity/analytics?from=all&to=2010-01-10&interval=day');
  const chart = await screen.findByRole('img', {name: /Activity over time/});
  expect(chart).toHaveTextContent('4 events');
  expect(
    screen.getByText(/For long ranges, adjacent periods are combined/)
  ).toBeInTheDocument();
  expect(chart.querySelector('rect title')).toHaveTextContent(
    'Jan 1, 2000 – Jan 2, 2000: 4'
  );
  fireEvent.click(screen.getByRole('button', {name: 'Show chart data'}));
  const table = await screen.findByRole('table', {name: 'Activity over time'});
  expect(
    within(table).getByText('Jan 1, 2000 – Jan 2, 2000').closest('tr')
  ).toHaveTextContent('4');
});

it('ignores a late response for the previous slice', async () => {
  const gate = Promise.withResolvers<void>();
  let started = false;
  server.use(
    http.get(API, async ({request}) => {
      const url = new URL(request.url);
      const activity = url.searchParams.get('activity');
      if (activity === 'created') {
        started = true;
        await gate.promise;
      }
      return HttpResponse.json({
        data: {
          version: 1,
          activity,
          interval: 'week',
          from: '2024-01-01',
          to: '2024-01-07',
          total: activity === 'created' ? 999 : 1,
          entries: 1,
          tags: 0,
          timeline: [
            {date: '2024-01-01', count: activity === 'created' ? 999 : 1},
          ],
          top_tags: [],
          top_entries: [],
        },
      });
    })
  );
  mount();
  await waitFor(() => expect(started).toBe(true));
  await select('Date to analyze', 'Entries reused');
  expect(
    await screen.findByRole('img', {name: /Activity over time/})
  ).toHaveTextContent('1 event');
  await act(async () => gate.resolve());
  expect(
    screen.getByRole('img', {name: /Activity over time/})
  ).not.toHaveTextContent('999');
});

it('resyncs stale analytics after a restore on another device', async () => {
  mount();
  await screen.findByText(/No activity in this slice/);
  const session = syncSession('test');
  await apiClient.forVersion(1).reuseEntry('1', 'version-reuse');
  await select('Date to analyze', 'Entries reused');
  await screen.findByRole('img', {name: /Activity over time/});
  const backup = await apiClient.getBackup();
  backup.entry_reuses = [];
  await apiClient.forVersion(1).restoreBackup(backup);
  const sync = vi.spyOn(session.sync, 'syncAll');
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  await screen.findByText(/No activity in this slice/);
  expect(sync).toHaveBeenCalled();
  expect(screen.queryByRole('img', {name: /Activity over time/})).toBeNull();
});

it.each([
  ['/test/activity/analytics', false],
  ['/someone/activity/analytics', true],
])('keeps %s private (signed in: %s)', async (path, signedIn) => {
  const reads = vi.spyOn(apiClientMethods, 'getAnalytics');
  const history = mount(path, signedIn);
  await waitFor(() =>
    expect(history.location.pathname).not.toContain('/activity/analytics')
  );
  expect(reads).not.toHaveBeenCalled();
});

it('preserves tags named activity and analytics', () => {
  expect(routeOf('/test/activity')).toEqual({
    page: 'user',
    user: 'test',
    tag: 'activity',
  });
  expect(routeOf('/test/analytics')).toEqual({
    page: 'user',
    user: 'test',
    tag: 'analytics',
  });
});

it('keeps a date and activity slice in the URL when returning from entry details', async () => {
  const {from, to} = recentRange(90);
  const history = mount(
    `/test/activity/analytics?activity=reused&interval=day&from=${from}&to=${to}`
  );
  await screen.findByText(/No activity in this slice/);
  await apiClient.forVersion(1).reuseEntry('1', 'return-slice');
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  const list = await screen.findByRole('list', {name: 'Top entries'});
  const before = history.location.pathname + history.location.search;
  fireEvent.click(within(list).getAllByRole('link')[0] as HTMLElement);
  await waitFor(() =>
    expect(history.location.pathname).toBe('/test/entries/1')
  );
  fireEvent.click(await screen.findByRole('link', {name: 'Back to analytics'}));
  await screen.findByRole('img', {name: /Activity over time/});
  expect(history.location.pathname + history.location.search).toBe(before);
  expect(
    screen.getByRole('combobox', {name: 'Date to analyze'})
  ).toHaveTextContent('Entries reused');
});

it.each(['abc', '0'])(
  'falls back to all tags for a malformed URL tag %s',
  async tag => {
    mount(`/test/activity/analytics?tag=${tag}`);
    await screen.findByText(/No activity in this slice/);
    expect(screen.getByRole('combobox', {name: 'Tag'})).toHaveTextContent(
      'All tags'
    );
  }
);

it('refuses a mismatched response version and preserves that error when resync fails', async () => {
  mount();
  await screen.findByText(/No activity in this slice/);
  const session = syncSession('test');
  const params = {
    activity: 'created',
    interval: 'day',
    ...recentRange(30),
  } as const;
  vi.spyOn(apiClientMethods, 'getAnalytics').mockResolvedValue({
    data: {
      ...params,
      version: 2,
      total: 0,
      entries: 0,
      tags: 0,
      timeline: [],
      top_tags: [],
      top_entries: [],
    },
  });
  const sync = vi
    .spyOn(session.sync, 'syncAll')
    .mockRejectedValue(new Error('Offline'));
  await expect(
    readAnalytics(session, params, new AbortController().signal)
  ).rejects.toBeInstanceOf(DataVersionChangedError);
  expect(sync).toHaveBeenCalled();
});
