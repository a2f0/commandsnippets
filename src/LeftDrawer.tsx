import React from 'react';
import CustomDrawer from './CustomDrawer';
import TagList from './TagList';

const LeftDrawer = function () {
  return (
    <CustomDrawer anchor="left">
      <TagList />
    </CustomDrawer>
  );
};
export default LeftDrawer;
