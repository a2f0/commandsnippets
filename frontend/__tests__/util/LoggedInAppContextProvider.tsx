// biome-ignore lint: style/useImportType
import React from 'react';

import {AppContext} from '../../src/AppContext';
import {store} from './loggedInStore';

export function LoggedInAppContextProvider({
  children,
}: React.PropsWithChildren) {
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
