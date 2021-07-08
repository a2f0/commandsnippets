import {createStyles, withStyles} from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import {MenuItemProps} from '@material-ui/core';
import React from 'react';

const MenuItemStyle = () => {
  return createStyles({
    root: {
      fontSize: 13,
    },
  });
};

interface IMenuItemProps {
  onClick: () => void;
  children?: React.ReactNode;
}

export const MuiMenuItem = React.forwardRef<MenuItemProps, IMenuItemProps>(
  (props: IMenuItemProps, ref) => (
    <MenuItem innerRef={ref} {...props}>
      {props.children}
    </MenuItem>
  )
);
MuiMenuItem.displayName = 'MuiMenuItem';
const StyledMenuItem = withStyles(MenuItemStyle)(MuiMenuItem);
export default React.memo(StyledMenuItem);
