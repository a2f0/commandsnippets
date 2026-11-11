import {render} from '@testing-library/react';
import {createElement, useEffect} from 'react';
import {afterAll, expect, it} from 'vitest';
import {useErrorStore} from '../../src/hooks/useErrorStore';
import {useAppState} from '../../src/lib/state/appState';
import {signIn, TEST_USER} from '../util/signIn';

const lifecycle: ('mounted' | 'unmounted' | 'reset')[] = [];
let unsubscribe: (() => void) | undefined;

function Probe() {
  const user = useAppState(state => state.loggedInUser);
  useEffect(() => {
    lifecycle.push('mounted');
    return () => {
      lifecycle.push('unmounted');
    };
  }, []);
  return createElement('span', null, user);
}

it('unmounts subscribers before shared teardown resets app state', () => {
  signIn();
  unsubscribe = useErrorStore.subscribe(() => lifecycle.push('reset'));
  const view = render(createElement(Probe));
  expect(view.getByText(TEST_USER)).toBeInTheDocument();
  expect(lifecycle).toEqual(['mounted']);
});

afterAll(() => {
  unsubscribe?.();
  // Observe the real shared afterEach rather than invoking a copied cleanup.
  expect(lifecycle).toEqual(['mounted', 'unmounted', 'reset']);
});
