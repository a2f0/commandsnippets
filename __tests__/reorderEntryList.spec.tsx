/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:8081/test/test-tag-1"}
 */

import '@testing-library/jest-dom';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import TestAppRouter from './TestAppRouter';
import {assignLoggedInCookie} from './util';
import {createMemoryHistory} from 'history';
import server from './msw';
import userEvent from '@testing-library/user-event';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('Entries List', () => {
  it('Reorders', async () => {
    const user = userEvent.setup();
    expect(window.location.href).toBe('http://localhost:8081/test/test-tag-1');
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
    let entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-1-subject');
    expect(entries[0]).toHaveTextContent('entry-1-body');
    expect(entries[1]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-2-body');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-3-body');
    expect(entries[3]).toHaveTextContent('entry-4-subject');
    expect(entries[3]).toHaveTextContent('entry-4-body');
    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    await user.pointer({target: entryDragHandleContainers[0]});
    const entryDragHandle = screen.getByRole('entryDragHandle');
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
      fireEvent.dragEnter(entries[2]);
      fireEvent.dragOver(entries[2]);
      await new Promise(res => setTimeout(res, 0));
      fireEvent.drop(entries[3]);
    });

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[0]).toHaveTextContent('entry-2-body');
    expect(entries[1]).toHaveTextContent('entry-3-subject');
    expect(entries[1]).toHaveTextContent('entry-3-body');
    expect(entries[2]).toHaveTextContent('entry-4-subject');
    expect(entries[2]).toHaveTextContent('entry-4-body');
    expect(entries[3]).toHaveTextContent('entry-1-subject');
    expect(entries[3]).toHaveTextContent('entry-1-body');
  });
});
