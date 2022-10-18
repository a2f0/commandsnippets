import {AppContext} from '../src/AppContext';
import React from 'react';
import {store} from './util';

export default function LoggedInAppContextProvider({
  children,
}: React.PropsWithChildren<{}>) {
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
