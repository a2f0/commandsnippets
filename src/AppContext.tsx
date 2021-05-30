import React, {ReactNode} from 'react';
import {AppStateStoreModel} from './AppStateStore';
import {observable} from 'mobx';
import AppStateStore from './AppStateStore';
import {Instance} from 'mobx-state-tree';
interface IAppContextProps {
  children: ReactNode;
  entrySortOrder: string;
  tagSortOrder: string;
  loggedInUser: string | null;
  mainPanel: string;
  appStateStore: Instance<typeof AppStateStoreModel>;
}

const AppContext = React.createContext<IAppContextProps | undefined>(undefined);

function AppContextProvider({children}: IAppContextProps) {
  const appConfig = observable({
    entrySortOrder: 'order',
    tagSortOrder: 'order',
    loggedInUser: null,
    mainPanel: 'EntryList',
    appStateStore: AppStateStore,
    children: children,
  });
  return (
    <AppContext.Provider value={appConfig}>{children}</AppContext.Provider>
  );
}

function useAppContext() {
  const context = React.useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within a AppContextProvider');
  }
  return context;
}

export {AppContextProvider, useAppContext};
