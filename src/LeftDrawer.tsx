import CustomDrawer from './CustomDrawer';
import React from 'react';
import TagListWrapper from './TagListWrapper';

const LeftDrawer = function () {
  return (
    <CustomDrawer anchor="left">
      <TagListWrapper />
    </CustomDrawer>
  );
};
export default React.memo(LeftDrawer);
