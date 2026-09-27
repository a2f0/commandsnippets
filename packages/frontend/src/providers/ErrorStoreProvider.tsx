import type React from 'react';

import {useErrorStore} from '../hooks/useErrorStore';

interface ErrorStoreProviderProps {
  children: React.ReactNode;
}

export const ErrorStoreProvider: React.FC<ErrorStoreProviderProps> = ({
  children,
}) => {
  useErrorStore(); // This initializes the global store
  return <>{children}</>;
};
