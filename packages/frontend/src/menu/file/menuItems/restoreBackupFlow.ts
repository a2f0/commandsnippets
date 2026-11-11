import type {
  Backup,
  RestoreResult,
} from '@commandsnippets/api-shared/responses';
import type {RestoreTarget} from '../../../lib/data/backup';

type Read = {request: number; username: string};
type Prepared = Read & {
  target: RestoreTarget;
  backup: Backup;
  current: {tags: number; entries: number};
};

/** Only the current file can supply a warning or its error. */
export type RestoreStep =
  | {step: 'closed'}
  | ({step: 'reading'; file: File} & Read)
  | {step: 'invalid'}
  | ({step: 'confirm'} & Prepared)
  | ({step: 'restoring'} & Prepared)
  | {step: 'done'; result: RestoreResult; shown: boolean}
  | {step: 'failed'; detail: string | undefined};

export type RestoreEvent =
  | ({type: 'read'; file: File} & Read)
  | {type: 'select'; username: string | null}
  | {type: 'close'}
  | ({type: 'ready'} & Prepared)
  | ({type: 'invalid' | 'readFailed' | 'confirm'} & Read)
  | ({type: 'restored'; result: RestoreResult; shown: boolean} & Read)
  | ({type: 'restoreFailed'; detail: string | undefined} & Read);

const matches = (state: RestoreStep, event: Read, step: RestoreStep['step']) =>
  state.step === step &&
  'request' in state &&
  state.request === event.request &&
  state.username === event.username;

const belongsToOther = (state: RestoreStep, username: string | null) =>
  (state.step === 'reading' || state.step === 'confirm') &&
  state.username !== username;

export function transitionRestoreBackup(
  state: RestoreStep,
  event: RestoreEvent
): RestoreStep {
  switch (event.type) {
    case 'read':
      return state.step === 'restoring'
        ? state
        : {
            step: 'reading',
            file: event.file,
            request: event.request,
            username: event.username,
          };
    case 'select':
      return belongsToOther(state, event.username) ? {step: 'closed'} : state;
    case 'close':
      return state.step === 'restoring' ? state : {step: 'closed'};
    case 'ready':
      return matches(state, event, 'reading')
        ? {
            step: 'confirm',
            request: event.request,
            username: event.username,
            target: event.target,
            backup: event.backup,
            current: event.current,
          }
        : state;
    case 'invalid':
      return matches(state, event, 'reading') ? {step: 'invalid'} : state;
    case 'readFailed':
      return matches(state, event, 'reading')
        ? {step: 'failed', detail: undefined}
        : state;
    case 'confirm':
      return state.step === 'confirm' && matches(state, event, 'confirm')
        ? {...state, step: 'restoring'}
        : state;
    case 'restored':
      return matches(state, event, 'restoring')
        ? {step: 'done', result: event.result, shown: event.shown}
        : state;
    case 'restoreFailed':
      return matches(state, event, 'restoring')
        ? {step: 'failed', detail: event.detail}
        : state;
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled restore event: ${JSON.stringify(value)}`);
}
