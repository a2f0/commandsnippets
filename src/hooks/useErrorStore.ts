import {useCallback, useState} from 'react';

import type {ErrorInfo} from '../components/ErrorBoundary';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  details?: string;
}

interface ErrorStore {
  errors: ErrorInfo[];
  logs: LogEntry[];
  addError: (error: ErrorInfo) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearErrors: () => void;
  clearLogs: () => void;
  getRecentLogs: (count?: number) => LogEntry[];
}

let globalErrorStore: ErrorStore | null = null;

export function useErrorStore(): ErrorStore {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    // Initialize with some default logs
    return [
      {
        id: 'init_1',
        timestamp: new Date(Date.now() - 2000),
        level: 'INFO',
        message: 'Application started',
        details: 'React app initialization complete',
      },
      {
        id: 'init_2',
        timestamp: new Date(Date.now() - 1000),
        level: 'DEBUG',
        message: 'Store initialized',
        details: 'MobX store setup complete',
      },
      {
        id: 'init_3',
        timestamp: new Date(),
        level: 'INFO',
        message: 'UI rendered successfully',
        details: 'Main components mounted',
      },
    ];
  });

  const addError = useCallback((error: ErrorInfo) => {
    setErrors(prev => [...prev, error]);

    // Also add to logs
    setLogs(prev => [
      ...prev,
      {
        id: `error_log_${error.id}`,
        timestamp: error.timestamp,
        level: 'ERROR',
        message: `Uncaught Error: ${error.error.message}`,
        details: `Component: ${error.componentStack.split('\n')[1]?.trim() || 'Unknown'}\nStack: ${error.error.stack}`,
      },
    ]);
  }, []);

  const addLog = useCallback((log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const getRecentLogs = useCallback(
    (count = 10) => {
      return logs
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, count);
    },
    [logs]
  );

  const store: ErrorStore = {
    errors,
    logs,
    addError,
    addLog,
    clearErrors,
    clearLogs,
    getRecentLogs,
  };

  // Store globally so it can be accessed from error boundary
  globalErrorStore = store;

  return store;
}

export function getGlobalErrorStore(): ErrorStore | null {
  return globalErrorStore;
}
