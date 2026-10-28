import {create} from 'zustand';

import type {ErrorInfo} from '../components/errorBoundary';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  details?: string;
}

interface ErrorStore {
  /** The errors the app's error boundary caught, oldest first. */
  errors: ErrorInfo[];
  /** What the HUD's Logs tab lists, oldest first. */
  logs: LogEntry[];
}

/**
 * The errors the app caught, for the HUD (outside production): one store for
 * the page, which every HUD reads, so an error recorded while none is
 * mounted is there when one is.
 */
export const useErrorStore = create<ErrorStore>(() => ({errors: [], logs: []}));

/** Records an error the error boundary caught (its `onError`). */
export function recordError(error: ErrorInfo): void {
  useErrorStore.setState(state => ({
    errors: [...state.errors, error],
    logs: [
      ...state.logs,
      {
        id: `error_log_${error.id}`,
        timestamp: error.timestamp,
        level: 'ERROR',
        message: `Uncaught Error: ${error.error.message}`,
        details: `Component: ${error.componentStack.split('\n')[1]?.trim() || 'Unknown'}\nStack: ${error.error.stack}`,
      },
    ],
  }));
}
