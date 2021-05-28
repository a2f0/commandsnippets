import {ReactNode} from 'react';
import {IAppStateStoreModel} from './AppStateStore';
interface IAppContextProps {
  children: ReactNode;
  entrySortOrder: string;
  tagSortOrder: string;
  loggedInUser: string | null;
  mainPanel: string;
  appStateStore: IAppStateStoreModel;
}
declare function AppContextProvider({children}: IAppContextProps): JSX.Element;
declare function useAppContext(): IAppContextProps;
export {AppContextProvider, useAppContext};
