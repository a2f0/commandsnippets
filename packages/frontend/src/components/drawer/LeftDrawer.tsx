import React from 'react';
import {SIDEBAR_WIDTH} from '../../lib/sidebarWidth';
import {TagListWrapper} from '../tags/TagListWrapper';
import {CustomDrawer} from './CustomDrawer';
import {TagSidebarResizer} from './TagSidebarResizer';

const LeftDrawer = () => (
  <CustomDrawer
    anchor="left"
    sx={{width: SIDEBAR_WIDTH, flexShrink: 0}}
    slotProps={{paper: {id: 'tagSidebar', sx: {width: SIDEBAR_WIDTH}}}}
  >
    <TagListWrapper />
    <TagSidebarResizer />
  </CustomDrawer>
);

const memoizedLeftDrawer = React.memo(LeftDrawer);

export {memoizedLeftDrawer as LeftDrawer};
