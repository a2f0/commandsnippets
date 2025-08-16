import React from 'react';

import {setAuthStore} from './lib/auth/authUtils';
import {type Store, store} from './lib/store/store';

export const AppContext = React.createContext<Store | undefined>(undefined);

function AppContextProvider({children}: React.PropsWithChildren) {
  React.useEffect(() => {
    setAuthStore(store);
  }, []);

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
