import CustomDrawer from './CustomDrawer';
import React from 'react';
import TagList from './TagList';

const LeftDrawer = function () {
  return (
    <CustomDrawer anchor="left">
      <TagList />
    </CustomDrawer>
  );
};
export default LeftDrawer;
