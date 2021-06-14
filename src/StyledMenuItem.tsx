import {createStyles, withStyles} from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import React from 'react';
import {WithStyles} from '@material-ui/core';

const MenuItemStyle = () => {
  return createStyles({
    root: {
      fontSize: 13,
    },
  });
};

interface IStyledMenuItemProps extends WithStyles<typeof MenuItemStyle> {
  onClick: () => void;
  children: React.PropsWithChildren<{}>;
  classes: {
    root: string;
  };
}

const StyledMenuItem = withStyles(MenuItemStyle)(
  ({onClick, classes, children}: IStyledMenuItemProps) => {
    return (
      <MenuItem onClick={onClick} classes={classes}>
        {children}
      </MenuItem>
    );
  }
);

export default StyledMenuItem;
