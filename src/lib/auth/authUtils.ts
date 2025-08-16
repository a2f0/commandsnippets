import {applySnapshot} from 'mobx-state-tree';
import {defaultState} from '../shared';
import type {Store} from '../store/store';

let storeInstance: Store | null = null;

export function setAuthStore(store: Store) {
  storeInstance = store;
}

export function resetApplicationState() {
  if (!storeInstance) {
    console.error('Store instance not set for auth utilities');
    return;
  }

  applySnapshot(storeInstance, defaultState);
}

export function handleUnauthorized() {
  console.info('Unauthorized access detected, resetting application state');
  resetApplicationState();
}
