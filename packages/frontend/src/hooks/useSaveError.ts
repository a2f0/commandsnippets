import {useRef, useState} from 'react';
import {useTypedTranslation} from '../i18n/hooks';
import {useMounted} from './useMounted';

export type SaveState =
  | {status: 'ready'; request: number}
  | {status: 'saving'; request: number}
  | {status: 'failed'; request: number; error: string};

export type SaveEvent =
  | {type: 'start'}
  | {type: 'succeeded'; request: number}
  | {type: 'failed'; request: number; error: string};

/** One save at a time, including its post-persistence callbacks. */
export function transitionSave(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case 'start':
      return state.status === 'saving'
        ? state
        : {status: 'saving', request: state.request + 1};
    case 'succeeded':
    case 'failed':
      if (state.status !== 'saving' || state.request !== event.request)
        return state;
      return event.type === 'failed'
        ? {status: 'failed', request: event.request, error: event.error}
        : {status: 'ready', request: event.request};
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled save event: ${JSON.stringify(value)}`);
}

const INITIAL_SAVE: SaveState = {status: 'ready', request: 0};

/** Busy/error UI and a synchronous guard; closing never cancels persistence. */
export function useSaveError(what: string) {
  const {t} = useTypedTranslation('common');
  const mounted = useMounted();
  const machine = useRef(INITIAL_SAVE);
  const [state, setState] = useState(INITIAL_SAVE);
  const send = (event: SaveEvent) => {
    const next = transitionSave(machine.current, event);
    machine.current = next;
    if (mounted.current) setState(next);
    return next;
  };
  const save = async <Value>(
    write: () => Promise<Value>,
    stored: (value: Value) => void | Promise<void>
  ) => {
    const previous = machine.current;
    const next = send({type: 'start'});
    if (next === previous || next.status !== 'saving') return;
    const {request} = next;
    let value: Value;
    try {
      // Invoke before any await: identity capture still belongs to this Save.
      value = await write();
    } catch (cause) {
      console.error(`Failed to ${what}:`, cause);
      const message = cause instanceof Error ? cause.message : String(cause);
      send({type: 'failed', request, error: t('saveFailed', {message})});
      return;
    }
    try {
      await stored(value);
    } catch (cause) {
      // A stored write must never be presented as Not saved.
      console.error(`Failed to finish ${what}:`, cause);
    } finally {
      send({type: 'succeeded', request});
    }
  };
  return {
    error: state.status === 'failed' ? state.error : null,
    saving: state.status === 'saving',
    save,
  };
}
