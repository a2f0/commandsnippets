import {waitFor} from '@testing-library/react';
import ReactDOM from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {initClickTracking} from '../../src/lib/clickTracking';
import {enableMocking} from '../../src/msw/enableMocking';

vi.mock('../../src/AppRouter', () => ({AppRouter: () => null}));
vi.mock('../../src/lib/clickTracking', () => ({initClickTracking: vi.fn()}));
vi.mock('../../src/msw/enableMocking', () => ({enableMocking: vi.fn()}));

const render = vi.fn();

function addRoot() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  return root;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('MODE', 'production');
  vi.spyOn(console, 'error');
  render.mockReset();
  vi.mocked(initClickTracking).mockReset();
  vi.mocked(enableMocking).mockReset().mockResolvedValue(undefined);
  vi.spyOn(ReactDOM, 'createRoot').mockReturnValue({render, unmount: vi.fn()});
});

afterEach(() => {
  vi.unstubAllEnvs();
  document.getElementById('root')?.remove();
});

describe('application startup', () => {
  it('reports a missing root instead of leaving an unhandled rejection', async () => {
    await import('../../src/index');
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'ERROR: Failed to start application:',
        expect.objectContaining({message: 'Failed to find the root element'})
      )
    );
    expect(initClickTracking).not.toHaveBeenCalled();
    expect(ReactDOM.createRoot).not.toHaveBeenCalled();
  });

  it.each(['createRoot', 'render', 'tracking'] as const)(
    'reports a synchronous %s failure',
    async stage => {
      addRoot();
      const failure = new Error(`${stage} failed`);
      const operation =
        stage === 'createRoot'
          ? vi.mocked(ReactDOM.createRoot)
          : stage === 'render'
            ? render
            : vi.mocked(initClickTracking);
      operation.mockImplementationOnce(() => {
        throw failure;
      });

      await import('../../src/index');
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          'ERROR: Failed to start application:',
          failure
        )
      );
      expect(initClickTracking).toHaveBeenCalledTimes(
        stage === 'tracking' ? 1 : 0
      );
      expect(render).toHaveBeenCalledTimes(stage === 'createRoot' ? 0 : 1);
    }
  );

  it('renders before initializing tracking', async () => {
    const root = addRoot();
    await import('../../src/index');
    await waitFor(() => expect(initClickTracking).toHaveBeenCalledOnce());
    expect(ReactDOM.createRoot).toHaveBeenCalledWith(root);
    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledBefore(vi.mocked(initClickTracking));
    expect(enableMocking).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('still renders after reporting an MSW startup failure', async () => {
    vi.stubEnv('MODE', 'test');
    addRoot();
    const failure = new Error('Mock worker startup failed');
    vi.mocked(enableMocking).mockRejectedValueOnce(failure);

    await import('../../src/index');
    await waitFor(() => expect(initClickTracking).toHaveBeenCalledOnce());

    expect(render).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'ERROR: Failed to start MSW:',
      failure
    );
  });
});
