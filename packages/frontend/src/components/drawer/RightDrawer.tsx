import React from 'react';

import {CustomDrawer} from './CustomDrawer';

const RightDrawer = () => <CustomDrawer anchor="right" />;
const memoizedRightDrawer = React.memo(RightDrawer);

export {memoizedRightDrawer as RightDrawer};
