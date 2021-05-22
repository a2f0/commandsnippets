import React from 'react';
import CustomDrawer from './CustomDrawer.jsx';
import TagList from './TagList.jsx';

const LeftDrawer = function () {
  return (
    <CustomDrawer anchor="left">
      <TagList />
    </CustomDrawer>
  );
};
export default LeftDrawer;
