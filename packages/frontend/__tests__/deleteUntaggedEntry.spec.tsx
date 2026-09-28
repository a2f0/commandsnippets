import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest';
import {tearleadsApi} from '../src/lib/api/tearleadsApi';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';
import {server} from './util/msw';
import {TestAppRouter} from './util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('Delete Untagged Entry', () => {
  let deleteEntrySpy: MockInstance;
  let untagEntrySpy: MockInstance;

  beforeEach(() => {
    deleteEntrySpy = vi
      .spyOn(tearleadsApi, 'deleteEntry')
      .mockResolvedValue(undefined);
    untagEntrySpy = vi
      .spyOn(tearleadsApi, 'untagEntry')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    deleteEntrySpy.mockRestore();
    untagEntrySpy.mockRestore();
  });

  it('should call deleteEntry when deleting from untagged entries view', async () => {
    const history = createMemoryHistory();
    const route = '/test?entries=untagged';
    history.push(route);
    render(<TestAppRouter history={history} />);

    // Wait for entries to load
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});

    // Find the first entry and right-click to open context menu
    const entryElement = screen.getByText('entry-1-subject');
    fireEvent.contextMenu(entryElement);

    // Wait for context menu to appear and find the Delete button for entry 1
    await waitFor(() => {
      const deleteButton = screen.getByRole('menuitem', {name: 'Delete'});
      expect(deleteButton).toBeInTheDocument();
    });

    // Click the Delete button
    const deleteButton = screen.getByRole('menuitem', {name: 'Delete'});
    fireEvent.click(deleteButton);

    // Wait for the deletion to be processed
    await waitFor(() => {
      // Should call deleteEntry for untagged entries
      expect(deleteEntrySpy).toHaveBeenCalledWith('1');
      expect(deleteEntrySpy).toHaveBeenCalledTimes(1);
    });

    // Should NOT call untagEntry
    expect(untagEntrySpy).not.toHaveBeenCalled();
  });

  it('should call untagEntry when removing from a tagged view', async () => {
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);

    // Wait for entries to load
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});

    // Find the first entry and right-click to open context menu
    const entryElement = screen.getByText('entry-1-subject');
    fireEvent.contextMenu(entryElement);

    // Wait for context menu to appear and find the Untag button
    await waitFor(() => {
      const untagButton = screen.getByRole('menuitem', {name: 'Untag'});
      expect(untagButton).toBeInTheDocument();
    });

    // Click the Untag button
    const untagButton = screen.getByRole('menuitem', {name: 'Untag'});
    fireEvent.click(untagButton);

    // Wait for the untagging to be processed
    await waitFor(() => {
      // Should call untagEntry for tagged entries
      expect(untagEntrySpy).toHaveBeenCalled();
      expect(untagEntrySpy).toHaveBeenCalledTimes(1);
    });

    // Should NOT call deleteEntry
    expect(deleteEntrySpy).not.toHaveBeenCalled();
  });

  it('should show Delete button in untagged view and not show Untag', async () => {
    const history = createMemoryHistory();
    const route = '/test?entries=untagged';
    history.push(route);
    render(<TestAppRouter history={history} />);

    // Wait for entries to load
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});

    // Right-click to open context menu in untagged view
    fireEvent.contextMenu(screen.getByText('entry-1-subject'));

    // Should show Delete button, not Untag
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('menuitem', {name: 'Delete'});
      expect(deleteButtons.length).toBeGreaterThan(0);
      expect(screen.queryByText('Untag')).not.toBeInTheDocument();
    });
  });

  it('should show Untag button in tagged view and not show Delete', async () => {
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);

    // Wait for entries to load
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});

    // Right-click to open context menu in tagged view
    fireEvent.contextMenu(screen.getByText('entry-1-subject'));

    // Should show Untag button, not Delete
    await waitFor(() => {
      const untagButtons = screen.getAllByRole('menuitem', {name: 'Untag'});
      expect(untagButtons.length).toBeGreaterThan(0);
      expect(
        screen.queryByRole('menuitem', {name: 'Delete'})
      ).not.toBeInTheDocument();
    });
  });
});
