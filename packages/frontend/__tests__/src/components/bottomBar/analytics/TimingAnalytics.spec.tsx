import {
  decomposeColor,
  getContrastRatio,
  type Theme,
  ThemeProvider,
} from '@mui/material/styles';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import invariant from 'invariant';
import type {ReactNode} from 'react';
import {I18nextProvider} from 'react-i18next';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  formatMs,
  KINDS,
  niceTicks,
  useKindColors,
} from '../../../../../src/components/bottomBar/analytics/chartStyle';
import {TimingAnalytics} from '../../../../../src/components/bottomBar/analytics/TimingAnalytics';
import {i18n} from '../../../../../src/i18n/i18n';
import {
  beginInteraction,
  clearMetrics,
  listKey,
  listShown,
  NOTIFY_MS,
  recordTiming,
} from '../../../../../src/lib/metrics/timings';
import {darkTheme, lightTheme} from '../../../../../src/theme/themes';

beforeEach(() => clearMetrics());

/** The waterfall of the interaction shown. */
const waterfall = () =>
  screen.getByRole('list', {
    name: 'Timings of the interaction, from the click',
  });

/** The tile labelled `label`: its label, value and caption. */
function tile(label: string): HTMLElement {
  const tileElement = screen.getByText(label).parentElement;
  invariant(tileElement, 'the tile is rendered');
  return tileElement;
}

const renderPanel = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <TimingAnalytics />
      </ThemeProvider>
    </I18nextProvider>
  );

/**
 * A tag switch with work of each kind during it: painted (at once), or
 * not, which counts the work to its end.
 */
async function switchTags({painted = true} = {}) {
  listShown(listKey({tag: painted ? 'docker' : 'other'}));
  beginInteraction('tag switch', listKey({tag: 'docker'}));
  const start = performance.now();
  recordTiming('network', 'GET /tags_entries', start, start + 120, '200');
  recordTiming('idb', 'useTagEntries', start + 1, start + 9, '12 rows');
  recordTiming('render', 'EntryList', start + 10, start + 14, '12 rows');
  // Told the HUD, and the paint.
  await screen.findAllByText('GET /tags_entries', {}, {timeout: 2000});
  if (painted) {
    await screen.findByText(/^painted /, {}, {timeout: 2000});
  }
}

describe('TimingAnalytics', () => {
  it('asks for an interaction while none is timed', () => {
    renderPanel();

    expect(
      screen.getByText(
        'Switch tags to time how long their entries take to show.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('No timings recorded yet.')).toBeInTheDocument();
  });

  it('lays out a tag switch: its time to paint, busy kinds and timings', async () => {
    renderPanel();
    await switchTags();

    expect(tile('Click to paint')).toHaveTextContent(/^Click to paint\d/);
    const waterfallRows = within(waterfall()).getAllByRole('listitem');
    expect(waterfallRows.map(row => row.firstChild?.textContent)).toEqual([
      'GET /tags_entries',
      'useTagEntries',
      'EntryList',
    ]);
    expect(screen.getAllByTestId('waterfall-bar')).toHaveLength(3);
    expect(
      screen.getByRole('combobox', {name: 'Interaction'})
    ).toHaveDisplayValue(/tag switch · tag:docker · \d/);
  });

  it('counts how long each kind was busy, to the end when not painted', async () => {
    renderPanel();
    await switchTags({painted: false});

    expect(tile('Click to paint')).toHaveTextContent(
      'Click to paintnot painted'
    );
    expect(tile('Network busy')).toHaveTextContent(
      'Network busy120 ms1 timing'
    );
    expect(tile('IndexedDB busy')).toHaveTextContent(
      'IndexedDB busy8.0 ms1 timing'
    );
    expect(
      screen.getByRole('combobox', {name: 'Interaction'})
    ).toHaveDisplayValue(/tag switch · tag:docker · not painted$/);
  });

  it('details the timing hovered or focused', async () => {
    renderPanel();
    await switchTags();

    expect(
      screen.getByText('Hover or focus a row for its details.')
    ).toBeInTheDocument();
    const row = within(waterfall()).getByText('useTagEntries').parentElement;
    invariant(row, 'the row is rendered');
    fireEvent.focus(row);

    expect(
      screen.getByText(
        /^useTagEntries · IndexedDB · starts at \+1\.0 ms, takes 8\.0 ms · 12 rows$/
      )
    ).toBeInTheDocument();
  });

  it('tables every timing by name, the most time first', async () => {
    renderPanel();
    await switchTags();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(row => row.children[1]?.textContent)).toEqual([
      'GET /tags_entries',
      'useTagEntries',
      'EntryList',
    ]);
    expect(within(table).getAllByText('Network').length).toBe(1);
    expect(
      screen.getByRole('img', {
        name: 'Duration of each timing (log scale), by when it began',
      })
    ).toBeInTheDocument();
  });

  it('moves its time window on while nothing new is timed', async () => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'performance',
      ],
    });
    try {
      clearMetrics();
      recordTiming('idb', 'useTags', performance.now());
      renderPanel();
      await act(() => vi.advanceTimersByTimeAsync(NOTIFY_MS));
      fireEvent.change(screen.getByRole('combobox', {name: 'Window'}), {
        target: {value: '10000'},
      });
      expect(screen.getByRole('table')).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(11_000));

      expect(screen.getByText('No timings recorded yet.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timings', async () => {
    renderPanel();
    await switchTags();

    fireEvent.click(screen.getByRole('button', {name: 'Clear'}));

    expect(
      await screen.findByText('No timings recorded yet.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('the charts’ numbers', () => {
  it.each([
    [3.44, '3.4 ms'],
    [412.4, '412 ms'],
    [12_345, '12.3 s'],
  ])('writes %s ms as %s', (ms, text) => {
    expect(formatMs(ms)).toBe(text);
  });

  it('ticks round steps from 0 to past the end', () => {
    expect(niceTicks(412)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(niceTicks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(formatMs(0)).toBe('0 ms');
  });
});

describe('the kinds’ colors', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('are grays apart and against the %s background', (_mode, theme: Theme) => {
    const {result} = renderHook(useKindColors, {
      wrapper: ({children}: {children: ReactNode}) => (
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      ),
    });
    const colors = KINDS.map(kind => result.current[kind]);
    for (const color of colors) {
      const [red, green, blue] = decomposeColor(color).values;
      expect(red === green && green === blue).toBe(true);
      expect(
        getContrastRatio(color, theme.palette.background.paper)
      ).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(colors).size).toBe(KINDS.length);
  });
});
