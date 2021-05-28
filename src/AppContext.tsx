import React, {ReactNode} from 'react';
import {IAppStateStoreModel} from './AppStateStore';
import {observable} from 'mobx';
import AppStateStore from './AppStateStore';

interface IAppContextProps {
  children: ReactNode;
  entrySortOrder: string;
  tagSortOrder: string;
  loggedInUser: string | null;
  mainPanel: string;
  appStateStore: IAppStateStoreModel;
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
