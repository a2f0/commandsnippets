import {useCallback, useEffect, useLayoutEffect, useReducer} from 'react';
import {AdminSignedOutError, getStaffStatus} from '../../lib/api/adminApi';
import {resetApplicationState, useAppState} from '../../lib/state/appState';

/** Every answer belongs to one user's check, including retries. */
export type StaffAccess =
  | {status: 'idle'; user: null; request: number}
  | {
      status: 'checking' | 'staff' | 'forbidden' | 'error' | 'expired';
      user: string;
      request: number;
    };

type Check = {user: string; request: number};
export type StaffAccessEvent =
  | {type: 'select'; user: string | null}
  | ({type: 'retry' | 'fail' | 'expire' | 'forbid'} & Check)
  | ({type: 'succeed'; isStaff: boolean} & Check);

const matches = (state: StaffAccess, event: Check) =>
  state.user === event.user && state.request === event.request;

function selectUser(state: StaffAccess, user: string | null): StaffAccess {
  if (state.user === user) return state;
  return user === null
    ? {status: 'idle', user, request: state.request + 1}
    : {status: 'checking', user, request: state.request + 1};
}

export function transitionStaffAccess(
  state: StaffAccess,
  event: StaffAccessEvent
): StaffAccess {
  switch (event.type) {
    case 'select':
      return selectUser(state, event.user);
    case 'retry':
      return state.status === 'error' && matches(state, event)
        ? {...state, status: 'checking', request: state.request + 1}
        : state;
    case 'forbid':
      return state.status === 'staff' && matches(state, event)
        ? {...state, status: 'forbidden'}
        : state;
    case 'succeed':
    case 'fail':
    case 'expire':
      if (state.status !== 'checking' || !matches(state, event)) return state;
      if (event.type === 'succeed') {
        return {...state, status: event.isStaff ? 'staff' : 'forbidden'};
      }
      return {...state, status: event.type === 'expire' ? 'expired' : 'error'};
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled staff access event: ${JSON.stringify(value)}`);
}

/** Initial reads and retries share the same cleaned-up effect. */
export function useStaffAccess() {
  const loggedInUser = useAppState(state => state.loggedInUser);
  const [state, send] = useReducer(transitionStaffAccess, {
    status: 'idle',
    user: null,
    request: 0,
  });
  useEffect(() => send({type: 'select', user: loggedInUser}), [loggedInUser]);

  useEffect(() => {
    if (state.status !== 'checking' || state.user !== loggedInUser) return;
    const {user, request} = state;
    let active = true;
    const current = () =>
      active && useAppState.getState().loggedInUser === user;
    void getStaffStatus().then(
      isStaff => {
        if (current()) send({type: 'succeed', user, request, isStaff});
      },
      (error: unknown) => {
        if (!current()) return;
        if (error instanceof AdminSignedOutError) {
          send({type: 'expire', user, request});
        } else {
          console.error('Admin access check failed:', error);
          send({type: 'fail', user, request});
        }
      }
    );
    return () => {
      active = false;
    };
  }, [state, loggedInUser]);

  // Publish before the accepted view can paint, but recheck the live user:
  // an ignored answer must not change the store.
  useLayoutEffect(() => {
    const app = useAppState.getState();
    if (state.user !== app.loggedInUser) return;
    if (state.status === 'staff' || state.status === 'forbidden') {
      app.setIsStaff(state.status === 'staff');
    } else if (state.status === 'expired') {
      resetApplicationState();
    }
  }, [state]);

  // Capture the identity, not the live appConfig proxy: old mutations can
  // settle after their AdminUsers instance and signed-in user have gone.
  const {user, request} = state;
  const forbid = useCallback(() => {
    if (user !== null) send({type: 'forbid', user, request});
  }, [user, request]);
  const retry = useCallback(() => {
    if (user !== null) send({type: 'retry', user, request});
  }, [user, request]);
  const access =
    state.user !== loggedInUser ||
    state.status === 'idle' ||
    state.status === 'expired'
      ? 'checking'
      : state.status;
  return {access, loggedInUser, retry, forbid};
}
