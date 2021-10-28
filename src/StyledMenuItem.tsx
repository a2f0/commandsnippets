import MenuItem from '@mui/material/MenuItem';
import {MenuItemProps} from '@mui/material';
import React from 'react';
import createStyles from '@mui/styles/createStyles';
import withStyles from '@mui/styles/withStyles';

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
  (props: IMenuItemProps) => <MenuItem {...props}>{props.children}</MenuItem>
);
MuiMenuItem.displayName = 'MuiMenuItem';
const StyledMenuItem = withStyles(MenuItemStyle)(MuiMenuItem);
export default React.memo(StyledMenuItem);
