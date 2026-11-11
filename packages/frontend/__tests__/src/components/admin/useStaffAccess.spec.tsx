import {act, renderHook, waitFor} from '@testing-library/react';
import {StrictMode, useLayoutEffect} from 'react';
import {
  type StaffAccess,
  type StaffAccessEvent,
  transitionStaffAccess,
  useStaffAccess,
} from '../../../../src/components/admin/useStaffAccess';
import * as adminApi from '../../../../src/lib/api/adminApi';
import {signIn, store} from '../../../util/signIn';

const check = {user: 'test', request: 1};
const idle: StaffAccess = {status: 'idle', user: null, request: 0};
const checking: StaffAccess = {status: 'checking', ...check};
const staff: StaffAccess = {status: 'staff', ...check};
const forbidden: StaffAccess = {status: 'forbidden', ...check};
const error: StaffAccess = {status: 'error', ...check};
const expired: StaffAccess = {status: 'expired', ...check};
const states = [idle, checking, staff, forbidden, error, expired];

interface Transition {
  name: string;
  state: StaffAccess;
  event: StaffAccessEvent;
  next: StaffAccess;
}

const transitions: Transition[] = [
  {
    name: 'select user',
    state: idle,
    event: {type: 'select', user: 'test'},
    next: checking,
  },
  {
    name: 'grant access',
    state: checking,
    event: {type: 'succeed', ...check, isStaff: true},
    next: staff,
  },
  {
    name: 'deny access',
    state: checking,
    event: {type: 'succeed', ...check, isStaff: false},
    next: forbidden,
  },
  {
    name: 'read failed',
    state: checking,
    event: {type: 'fail', ...check},
    next: error,
  },
  {
    name: 'session expired',
    state: checking,
    event: {type: 'expire', ...check},
    next: expired,
  },
  {
    name: 'retry failed read',
    state: error,
    event: {type: 'retry', ...check},
    next: {...checking, request: 2},
  },
  {
    name: 'revoke access',
    state: staff,
    event: {type: 'forbid', ...check},
    next: forbidden,
  },
  ...states.map(state => ({
    name: `replace ${state.status}`,
    state,
    event: {type: 'select', user: 'other'} as const,
    next: {
      status: 'checking',
      user: 'other',
      request: state.request + 1,
    } as const,
  })),
  ...states
    .filter(state => state !== idle)
    .map(state => ({
      name: `sign out ${state.status}`,
      state,
      event: {type: 'select', user: null} as const,
      next: {status: 'idle', user: null, request: state.request + 1} as const,
    })),
];

it.each(transitions)('$name', ({state, event, next}) => {
  expect(transitionStaffAccess(state, event)).toEqual(next);
});

const completions: Exclude<StaffAccessEvent, {type: 'select'}>[] = [
  {type: 'succeed', ...check, isStaff: true},
  {type: 'fail', ...check},
  {type: 'expire', ...check},
];

it.each(states)('ignores inapplicable events in $status', state => {
  const ignored: StaffAccessEvent[] = [{type: 'select', user: state.user}];
  if (state.status !== 'checking') ignored.push(...completions);
  if (state.status !== 'staff') ignored.push({type: 'forbid', ...check});
  if (state.status !== 'error') ignored.push({type: 'retry', ...check});
  for (const event of ignored)
    expect(transitionStaffAccess(state, event)).toBe(state);
});

it.each(['checking', 'staff', 'error'] as const)(
  'rejects mismatched request or user in %s',
  status => {
    const state: StaffAccess = {...check, status};
    const events: Exclude<StaffAccessEvent, {type: 'select'}>[] = [
      ...completions,
      {type: 'forbid', ...check},
      {type: 'retry', ...check},
    ];
    for (const event of events) {
      expect(transitionStaffAccess(state, {...event, user: 'other'})).toBe(
        state
      );
      expect(transitionStaffAccess(state, {...event, request: 0})).toBe(state);
    }
  }
);

it('does not accept an old request after reset and reselecting the same user', () => {
  const events: StaffAccessEvent[] = [
    {type: 'select', user: null},
    {type: 'select', user: 'test'},
    {type: 'succeed', ...check, isStaff: true},
  ];
  expect(events.reduce(transitionStaffAccess, checking)).toEqual({
    ...checking,
    request: 3,
  });
});

it('publishes the staff flag before the granted view can paint', async () => {
  signIn();
  store.setIsStaff(false);
  vi.spyOn(adminApi, 'getStaffStatus').mockResolvedValue(true);
  const flags: boolean[] = [];
  const {result, unmount} = renderHook(() => {
    const access = useStaffAccess();
    useLayoutEffect(() => {
      if (access.access === 'staff') flags.push(store.isStaff);
    }, [access.access]);
    return access;
  });
  await waitFor(() => expect(result.current.access).toBe('staff'));
  unmount();
  expect(flags).toEqual([true]);
});

it.each(['signed out', 'expired'])(
  'keeps the loading view while %s instead of exposing internal states',
  async session => {
    if (session === 'expired') signIn();
    const checkAccess = vi
      .spyOn(adminApi, 'getStaffStatus')
      .mockRejectedValue(new adminApi.AdminSignedOutError());
    const observed: string[] = [];
    const {result, unmount} = renderHook(() => {
      const access = useStaffAccess();
      observed.push(access.access);
      return access;
    });
    if (session === 'expired')
      await waitFor(() => expect(store.loggedInUser).toBeNull());
    else expect(checkAccess).not.toHaveBeenCalled();
    unmount();
    expect(observed).not.toContain('idle');
    expect(observed).not.toContain('expired');
    expect(result.current.access).toBe('checking');
  }
);

it('starts a replacement check while checking and ignores a late abort', async () => {
  signIn();
  const old = Promise.withResolvers<boolean>();
  const replacement = Promise.withResolvers<boolean>();
  const checks = vi
    .spyOn(adminApi, 'getStaffStatus')
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(replacement.promise);
  const {result, unmount} = renderHook(useStaffAccess, {wrapper: StrictMode});
  await waitFor(() => expect(checks).toHaveBeenCalledTimes(1));
  act(() => store.setLoggedInUser('other'));
  await waitFor(() => expect(checks).toHaveBeenCalledTimes(2));
  await act(async () => {
    old.reject(new DOMException('cancelled', 'AbortError'));
    await old.promise.catch(() => undefined);
  });
  expect(result.current.access).toBe('checking');
  await act(async () => {
    replacement.resolve(true);
    await replacement.promise;
  });
  expect(result.current.access).toBe('staff');
  expect(store.loggedInUser).toBe('other');
  expect(store.isStaff).toBe(true);
  unmount();
});

it('keeps a replacement flag when identity changes before publication', async () => {
  signIn();
  const replacement = Promise.withResolvers<boolean>();
  const checks = vi
    .spyOn(adminApi, 'getStaffStatus')
    .mockResolvedValueOnce(false)
    .mockReturnValueOnce(replacement.promise);
  const {result, unmount} = renderHook(() => {
    // Run before the hook's publication effect, after its answer rendered.
    useLayoutEffect(() => {
      if (access.access === 'forbidden') {
        store.setLoggedInUser('other');
        store.setIsStaff(true);
      }
    });
    const access = useStaffAccess();
    return access;
  });
  await waitFor(() => expect(checks).toHaveBeenCalledTimes(2));
  const flag = store.isStaff;
  const user = store.loggedInUser;
  unmount();
  await act(async () => {
    replacement.resolve(true);
    await replacement.promise;
  });
  expect(user).toBe('other');
  expect(result.current.access).toBe('checking');
  expect(flag).toBe(true);
});

it('ignores a forbidden callback retained across a same-user replacement', async () => {
  signIn();
  vi.spyOn(adminApi, 'getStaffStatus').mockResolvedValue(true);
  const {result, unmount} = renderHook(useStaffAccess);
  await waitFor(() => expect(result.current.access).toBe('staff'));
  const oldForbid = result.current.forbid;
  act(() => store.setLoggedInUser(null));
  expect(result.current.access).toBe('checking');
  act(() => store.setLoggedInUser('test'));
  await waitFor(() => expect(result.current.access).toBe('staff'));
  act(oldForbid);
  expect(result.current.access).toBe('staff');
  expect(store.isStaff).toBe(true);
  unmount();
});
