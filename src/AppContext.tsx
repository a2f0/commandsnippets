import React from 'react';

import {store, type TStore} from './lib/store/AppStateStore';

export const AppContext = React.createContext<TStore | undefined>(undefined);

function AppContextProvider({children}: React.PropsWithChildren) {
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

function useAppContext() {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within a AppContextProvider');
  }
  return context;
}

export {AppContextProvider, useAppContext};
