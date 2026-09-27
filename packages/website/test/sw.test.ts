import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// public/sw.js replaces the old app's service worker; run it against fake
// service worker globals and record what it does.
const source = readFileSync(join(import.meta.dir, '../public/sw.js'), 'utf8');

type Listener = (event: {waitUntil: (work: Promise<unknown>) => void}) => void;

const install = () => {
  const listeners = new Map<string, Listener>();
  const calls: string[] = [];
  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
    },
    skipWaiting: async () => {
      calls.push('skipWaiting');
    },
    registration: {
      unregister: async () => {
        calls.push('unregister');
        return true;
      },
    },
    clients: {
      matchAll: async (options: {type: string}) => {
        calls.push(`matchAll ${options.type}`);
        return [
          'https://commandsnippets.com/',
          'https://commandsnippets.com/dan',
        ].map(url => ({
          url,
          navigate: async (to: string) => {
            calls.push(`navigate ${to}`);
          },
        }));
      },
    },
  };
  const caches = {
    keys: async () => [
      'workbox-precache-v2-https://commandsnippets.com/',
      'tearleads-html-cache',
    ],
    delete: async (key: string) => {
      calls.push(`delete ${key}`);
      return true;
    },
  };
  new Function('self', 'caches', source)(self, caches);
  const dispatch = async (type: string) => {
    const work: Promise<unknown>[] = [];
    listeners.get(type)?.({waitUntil: promise => work.push(promise)});
    await Promise.all(work);
  };
  return {listeners, calls, dispatch};
};

test('takes over from the old worker as soon as it installs', async () => {
  const {calls, dispatch} = install();
  await dispatch('install');
  expect(calls).toEqual(['skipWaiting']);
});

test('empties the caches, unregisters, then reloads open pages', async () => {
  const {calls, dispatch} = install();
  await dispatch('activate');
  expect(calls).toEqual([
    'delete workbox-precache-v2-https://commandsnippets.com/',
    'delete tearleads-html-cache',
    'unregister',
    'matchAll window',
    'navigate https://commandsnippets.com/',
    'navigate https://commandsnippets.com/dan',
  ]);
});

test('leaves every request to the network', () => {
  expect([...install().listeners.keys()].sort()).toEqual([
    'activate',
    'install',
  ]);
});
