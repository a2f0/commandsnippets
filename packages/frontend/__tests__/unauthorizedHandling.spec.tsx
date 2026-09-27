import '@testing-library/jest-dom';

import {act} from '@testing-library/react';
import {applySnapshot} from 'mobx-state-tree';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';

import {tearleadsApi} from '../src/lib/api/tearleadsApi';
import {defaultState} from '../src/lib/shared';
import {store} from '../src/lib/store/store';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';

Element.prototype.scrollIntoView = vi.fn();

const server = setupServer(
  http.get('http://localhost:9001/api/v1/tags', () => {
    return HttpResponse.json({error: 'Forbidden'}, {status: 403});
  }),
  http.get('http://localhost:9001/api/v1/entries', () => {
    return HttpResponse.json({error: 'Forbidden'}, {status: 403});
  }),
  http.post('http://localhost:9001/api/v1/tags', () => {
    return HttpResponse.json({error: 'Forbidden'}, {status: 403});
  }),
  http.get('http://localhost:9001/api/v1/user/', () => {
    return HttpResponse.json({error: 'Forbidden'}, {status: 403});
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  // Reset store state after each test using applySnapshot
  act(() => {
    applySnapshot(store, defaultState);
  });
});
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('403 Unauthorized Handling', () => {
  it('should reset application state when receiving a 403 response from createTag', async () => {
    // Set initial state using act
    act(() => {
      applySnapshot(store, {
        ...defaultState,
        loggedInUser: 'testuser',
        selectedTheme: 'lightTheme',
        tagSortOrder: 'name',
      });
    });

    expect(store.loggedInUser).toBe('testuser');
    expect(store.selectedTheme).toBe('lightTheme');
    expect(store.tagSortOrder).toBe('name');

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // This will trigger a 403 response which should reset the state
    // The API will throw due to !resp.ok, but the 403 handler should still run
    await expect(tearleadsApi.createTag('new-tag')).rejects.toThrow();

    // Verify that the unauthorized handler was called
    expect(consoleSpy).toHaveBeenCalledWith(
      'Unauthorized access detected, resetting application state'
    );

    // Verify that the application state was reset to defaults
    expect(store.loggedInUser).toBeNull();
    expect(store.selectedTheme).toBe('darkTheme');
    expect(store.tagSortOrder).toBe('order');

    consoleSpy.mockRestore();
  });

  it('should reset application state when receiving a 403 response from getTags', async () => {
    // Set initial state
    act(() => {
      applySnapshot(store, {
        ...defaultState,
        loggedInUser: 'testuser',
        selectedTheme: 'lightTheme',
        entryNew: 'some-entry',
      });
    });

    expect(store.loggedInUser).toBe('testuser');
    expect(store.selectedTheme).toBe('lightTheme');
    expect(store.entryNew).toBe('some-entry');

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // This will trigger a 403 response
    await expect(
      tearleadsApi.getTags({
        'filter[user.username]': 'testuser',
        'page[number]': 1,
        sort: 'order',
      })
    ).rejects.toThrow();

    // Verify state was reset to defaults
    expect(store.loggedInUser).toBeNull();
    expect(store.selectedTheme).toBe('darkTheme');
    expect(store.entryNew).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should reset application state when receiving a 403 response from getCurrentUser', async () => {
    // Set initial state
    act(() => {
      applySnapshot(store, {
        ...defaultState,
        loggedInUser: 'testuser',
        tagNew: 'some-tag',
        showTagCounts: true,
      });
    });

    expect(store.loggedInUser).toBe('testuser');
    expect(store.tagNew).toBe('some-tag');
    expect(store.showTagCounts).toBe(true);

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // This will trigger a 403 response
    await expect(tearleadsApi.getCurrentUser()).rejects.toThrow();

    // Verify state was reset to defaults
    expect(store.loggedInUser).toBeNull();
    expect(store.tagNew).toBeNull();
    expect(store.showTagCounts).toBe(false);

    consoleSpy.mockRestore();
  });

  it('should handle 403 on getEntries endpoint', async () => {
    // Set initial state
    act(() => {
      applySnapshot(store, {
        ...defaultState,
        loggedInUser: 'testuser',
        entrySortOrder: 'subject',
      });
    });

    expect(store.loggedInUser).toBe('testuser');
    expect(store.entrySortOrder).toBe('subject');

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    // This will trigger a 403 response
    await expect(
      tearleadsApi.getEntries({
        'filter[user.username]': 'testuser',
        'page[number]': 1,
      })
    ).rejects.toThrow();

    // Verify state was reset to defaults
    expect(store.loggedInUser).toBeNull();
    expect(store.entrySortOrder).toBe('date_updated');

    consoleSpy.mockRestore();
  });
});
