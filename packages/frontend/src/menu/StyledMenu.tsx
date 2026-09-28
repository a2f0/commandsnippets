import {Fade, Menu} from '@mui/material';
import type React from 'react';

interface IStyledMenuProps {
  id: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** The drop-down under a menu bar button (File, View, Tags, ...). */
export const StyledMenu = ({
  id,
  anchorEl,
  open,
  onClose,
  children,
}: IStyledMenuProps) => {
  return (
    <Menu
      id={id}
      anchorEl={anchorEl}
      onClose={onClose}
      transitionDuration={0}
      anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
      transformOrigin={{vertical: 'top', horizontal: 'left'}}
      keepMounted
      open={open}
      slots={{transition: Fade}}
    >
      {children}
    </Menu>
  );
};
