// biome-ignore: React is needed as a value for JSX
import type React from 'react';

import {AppContext} from '../../src/AppContext';
import {store} from './loggedInStore';

export default function LoggedInAppContextProvider({
  children,
}: React.PropsWithChildren) {
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
