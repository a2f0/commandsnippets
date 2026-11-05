import type {Analytics} from '@commandsnippets/api-shared/responses';

/** The slice shown: read for `request`, then loaded or failed. */
export type AnalyticsRead =
  | {status: 'loading'; request: number}
  | {status: 'loaded'; data: Analytics}
  | {status: 'failed'};

export type AnalyticsReadEvent =
  | {type: 'start'; request: number}
  | {type: 'succeed'; request: number; data: Analytics}
  | {type: 'fail'; request: number};

/** Only the read still current may finish: a later one replaces it. */
export function transitionAnalyticsRead(
  state: AnalyticsRead,
  event: AnalyticsReadEvent
): AnalyticsRead {
  switch (event.type) {
    case 'start':
      return {status: 'loading', request: event.request};
    case 'succeed':
      return state.status === 'loading' && state.request === event.request
        ? {status: 'loaded', data: event.data}
        : state;
    case 'fail':
      return state.status === 'loading' && state.request === event.request
        ? {status: 'failed'}
        : state;
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled analytics event: ${JSON.stringify(value)}`);
}
