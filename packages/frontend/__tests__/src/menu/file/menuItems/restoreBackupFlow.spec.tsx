import type {
  Backup,
  RestoreResult,
} from '@commandsnippets/api-shared/responses';
import {MenuList} from '@mui/material';
import {ThemeProvider} from '@mui/material/styles';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {i18n} from '../../../../../src/i18n/i18n';
import * as backupData from '../../../../../src/lib/data/backup';
import {RestoreBackup} from '../../../../../src/menu/file/menuItems/RestoreBackup';
import {
  type RestoreEvent,
  type RestoreStep,
  transitionRestoreBackup,
} from '../../../../../src/menu/file/menuItems/restoreBackupFlow';
import {darkTheme} from '../../../../../src/theme/themes';
import {signIn, store} from '../../../../util/signIn';

const backup: Backup = {
  format: 'commandsnippets-backup',
  version: 1,
  date_exported: '2026-10-01T09:30:00.000000',
  user: {id: '42', username: 'backup-owner'},
  tags: [],
  entries: [],
  tags_entries: [],
  entry_reuses: [],
};
const file = new File([JSON.stringify(backup)], 'backup.json');
const read = {username: 'test', request: 1};
const prepared = {
  ...read,
  backup,
  target: {accountId: '1', version: 1},
  current: {tags: 0, entries: 0},
};
const result: RestoreResult = {
  data_version: 2,
  tags: 0,
  entries: 0,
  tags_entries: 0,
  entry_reuses: 0,
};
const closed: RestoreStep = {step: 'closed'};
const reading: RestoreStep = {step: 'reading', ...read, file};
const confirm: RestoreStep = {step: 'confirm', ...prepared};
const restoring: RestoreStep = {step: 'restoring', ...prepared};
const invalid: RestoreStep = {step: 'invalid'};
const failed: RestoreStep = {step: 'failed', detail: undefined};
const done: RestoreStep = {step: 'done', result, shown: true};
const states = [closed, reading, confirm, restoring, invalid, failed, done];

interface Transition {
  name: string;
  state: RestoreStep;
  event: RestoreEvent;
  next: RestoreStep;
}
const transitions: Transition[] = [
  {
    name: 'warn after reading',
    state: reading,
    event: {type: 'ready', ...prepared},
    next: confirm,
  },
  {
    name: 'refuse invalid file',
    state: reading,
    event: {type: 'invalid', ...read},
    next: invalid,
  },
  {
    name: 'report target read failure',
    state: reading,
    event: {type: 'readFailed', ...read},
    next: failed,
  },
  {
    name: 'confirm warning',
    state: confirm,
    event: {type: 'confirm', ...read},
    next: restoring,
  },
  {
    name: 'finish restore',
    state: restoring,
    event: {type: 'restored', ...read, result, shown: true},
    next: done,
  },
  {
    name: 'finish without adoption',
    state: restoring,
    event: {type: 'restored', ...read, result, shown: false},
    next: {...done, shown: false},
  },
  {
    name: 'report API detail',
    state: restoring,
    event: {type: 'restoreFailed', ...read, detail: 'refused'},
    next: {step: 'failed', detail: 'refused'},
  },
  ...states.map(state => ({
    name: `read from ${state.step}`,
    state,
    event: {type: 'read', ...read, request: 2, file} as const,
    next: state.step === 'restoring' ? state : {...reading, request: 2},
  })),
  ...states.map(state => ({
    name: `close ${state.step}`,
    state,
    event: {type: 'close'} as const,
    next: state.step === 'restoring' ? state : closed,
  })),
  ...states.map(state => ({
    name: `replace user in ${state.step}`,
    state,
    event: {type: 'select', username: 'other'} as const,
    next: state.step === 'reading' || state.step === 'confirm' ? closed : state,
  })),
];
it.each(transitions)('$name', ({state, event, next}) => {
  const actual = transitionRestoreBackup(state, event);
  expect(actual).toEqual(next);
  // A new restoring object would restart the effect and repeat the mutation.
  if (state.step === 'restoring' && next === state) expect(actual).toBe(state);
});

const readEvents: Extract<RestoreEvent, {request: number}>[] = [
  {type: 'ready', ...prepared},
  {type: 'invalid', ...read},
  {type: 'readFailed', ...read},
];
const restoreEvents: Extract<RestoreEvent, {request: number}>[] = [
  {type: 'restored', ...read, result, shown: true},
  {type: 'restoreFailed', ...read, detail: 'refused'},
];
it.each(states)('ignores inapplicable events in $step', state => {
  const ignored: RestoreEvent[] = [{type: 'select', username: 'test'}];
  if (state.step !== 'reading') ignored.push(...readEvents);
  if (state.step !== 'restoring') ignored.push(...restoreEvents);
  if (state.step !== 'confirm') ignored.push({type: 'confirm', ...read});
  for (const event of ignored)
    expect(transitionRestoreBackup(state, event)).toBe(state);
});
it.each([reading, confirm, restoring])(
  'rejects stale user/request in $step',
  state => {
    const events: Extract<RestoreEvent, {request: number}>[] = [
      ...readEvents,
      ...restoreEvents,
      {type: 'confirm', ...read},
    ];
    for (const event of events) {
      expect(transitionRestoreBackup(state, {...event, request: 0})).toBe(
        state
      );
      expect(
        transitionRestoreBackup(state, {...event, username: 'other'})
      ).toBe(state);
    }
  }
);
it('ignores a late read after close and replacement', () => {
  const events: RestoreEvent[] = [
    {type: 'close'},
    {type: 'read', ...read, request: 2, file},
    ...readEvents,
  ];
  expect(events.reduce(transitionRestoreBackup, reading)).toEqual({
    ...reading,
    request: 2,
  });
});

const RestoreWithProviders = () => (
  <I18nextProvider i18n={i18n}>
    <ThemeProvider theme={darkTheme}>
      <MenuList>
        <RestoreBackup onClose={() => {}} />
      </MenuList>
    </ThemeProvider>
  </I18nextProvider>
);

function selectFile() {
  const input = document.getElementById('restoreBackupFile');
  invariant(input instanceof HTMLInputElement, 'the file input is mounted');
  fireEvent.change(input, {target: {files: [file]}});
  return input;
}

it.each(['cancel', 'unmount', 'user change', 'empty selection'])(
  'abandons file work after %s',
  async action => {
    signIn();
    const text = Promise.withResolvers<string>();
    const readText = vi.spyOn(file, 'text').mockReturnValueOnce(text.promise);
    const target = vi
      .spyOn(backupData, 'restoreTarget')
      .mockResolvedValue(prepared.target);
    vi.spyOn(backupData, 'liveCounts').mockResolvedValue(prepared.current);
    const {unmount} = render(<RestoreWithProviders />);
    const input = selectFile();
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(1));
    if (action === 'cancel') {
      fireEvent.click(screen.getByText('Restore Backup'));
      fireEvent(input, new Event('cancel', {bubbles: true}));
    }
    if (action === 'unmount') unmount();
    if (action === 'user change') act(() => store.setLoggedInUser('other'));
    if (action === 'empty selection')
      fireEvent.change(input, {target: {files: []}});
    await act(async () => {
      text.resolve(JSON.stringify(backup));
      await text.promise;
    });
    const dialog = screen.queryByRole('dialog');
    unmount();
    expect(target).not.toHaveBeenCalled();
    expect(dialog).toBeNull();
  }
);

it('ignores an old target failure after a replacement warning is cancelled', async () => {
  signIn();
  const old = Promise.withResolvers<backupData.RestoreTarget>();
  const targets = vi
    .spyOn(backupData, 'restoreTarget')
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue(prepared.target);
  vi.spyOn(backupData, 'liveCounts').mockResolvedValue(prepared.current);
  const errors = vi.spyOn(console, 'error');
  const {unmount} = render(<RestoreWithProviders />);
  selectFile();
  await waitFor(() => expect(targets).toHaveBeenCalledTimes(1));
  selectFile();
  fireEvent.click(await screen.findByRole('button', {name: 'Cancel'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await act(async () => {
    old.reject(new DOMException('cancelled', 'AbortError'));
    await old.promise.catch(() => undefined);
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(errors).not.toHaveBeenCalled();
  unmount();
});

it.each([
  {
    name: 'failed restore',
    error: new Error('Restore unavailable'),
    diagnostic: 'ERROR: backup restore failed:',
  },
  {
    name: 'restored but not adopted',
    error: new backupData.RestoreNotAdoptedError(
      result,
      new Error('Database closed')
    ),
    diagnostic: 'ERROR: restored, but not taken up here:',
  },
])(
  'logs a $name after unmount without reopening the dialog',
  async ({error, diagnostic}) => {
    signIn();
    vi.spyOn(backupData, 'restoreTarget').mockResolvedValue(prepared.target);
    vi.spyOn(backupData, 'liveCounts').mockResolvedValue(prepared.current);
    const pending = Promise.withResolvers<RestoreResult>();
    const restore = vi
      .spyOn(backupData, 'restoreBackup')
      .mockReturnValueOnce(pending.promise);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const {unmount} = render(<RestoreWithProviders />);
    selectFile();
    fireEvent.click(
      await screen.findByRole('button', {name: 'Restore backup'})
    );
    await waitFor(() =>
      expect(restore).toHaveBeenCalledWith('test', prepared.target, backup)
    );
    unmount();
    await act(async () => {
      pending.reject(error);
      await pending.promise.catch(() => undefined);
    });
    expect(errors.mock.calls).toEqual([[diagnostic, error]]);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  }
);
