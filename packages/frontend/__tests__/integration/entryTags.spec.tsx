import {render, screen, waitFor, within} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(async () => {
  signIn();
  assignLoggedInCookie();
  // The mock API's fixtures (entries 1 to 4) are all in tag 1: entry 1 in
  // tags 3 and 2 as well, and one more in no tag.
  await apiClient.forVersion(1).tagEntry('3', '1');
  await apiClient.forVersion(1).tagEntry('2', '1');
  await apiClient.forVersion(1).createEntry('entry-9-subject', 'body');
});

function renderApp(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

/** The row of the entry with this subject. */
async function rowOf(subject: string) {
  const row = (await screen.findByText(subject)).closest('[role="entry"]');
  invariant(row instanceof HTMLElement, `${subject} is in a row`);
  return row;
}

/** The tags shown under the entry with this subject. */
async function tagsUnder(subject: string) {
  const list = within(await rowOf(subject)).queryByRole('list', {
    name: 'Tags',
  });
  return list === null
    ? []
    : within(list)
        .getAllByRole('listitem')
        .map(item => item.textContent);
}

async function expectTags(subject: string, names: string[]) {
  // The first load syncs the tags, entries and junctions before any show.
  await waitFor(async () => expect(await tagsUnder(subject)).toEqual(names), {
    timeout: 3000,
  });
}

describe('The tags under each entry in the list', () => {
  it('on a tag list, are the entry’s other tags, by name', async () => {
    renderApp('/test/test-tag-1');

    await expectTags('entry-1-subject', ['test-tag-2', 'test-tag-3']);
    // In this tag alone: no tags under it.
    expect(await tagsUnder('entry-2-subject')).toEqual([]);
  });

  it('on another tag’s list, leave that tag out', async () => {
    renderApp('/test/test-tag-2');

    await expectTags('entry-1-subject', ['test-tag-1', 'test-tag-3']);
  });

  it('on the all-entries list, are all of the entry’s tags', async () => {
    renderApp('/test?entries=all');

    await expectTags('entry-1-subject', [
      'test-tag-1',
      'test-tag-2',
      'test-tag-3',
    ]);
    await expectTags('entry-2-subject', ['test-tag-1']);
    expect(await tagsUnder('entry-9-subject')).toEqual([]);
  });

  it('are labels, not buttons or links', async () => {
    renderApp('/test?entries=all');
    await expectTags('entry-2-subject', ['test-tag-1']);

    const list = within(await rowOf('entry-2-subject')).getByRole('list', {
      name: 'Tags',
    });
    expect(within(list).queryAllByRole('button')).toEqual([]);
    expect(within(list).queryAllByRole('link')).toEqual([]);
  });

  it('are none on the untagged list', async () => {
    renderApp('/test?entries=untagged');

    expect(await tagsUnder('entry-9-subject')).toEqual([]);
  });
});
