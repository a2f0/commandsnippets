import {applySnapshot} from 'mobx-state-tree';
import {defaultState} from '../shared';
import {store} from '../store/store';

export function resetApplicationState() {
  applySnapshot(store, defaultState);
}

export function handleUnauthorized() {
  console.info('Unauthorized access detected, resetting application state');
  resetApplicationState();
}
