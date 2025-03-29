import React from 'react';

import TagListWrapper from '../TagListWrapper';
import CustomDrawer from './CustomDrawer';

const LeftDrawer = () => (
  <CustomDrawer anchor="left">
    <TagListWrapper />
  </CustomDrawer>
);
export default React.memo(LeftDrawer);
