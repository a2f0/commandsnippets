import {Button, type SxProps, type Theme} from '@mui/material';
import React from 'react';

/** The menu bar's text-button look, also used by its plain links. */
export const menuBarButtonSx: SxProps<Theme> = {
  alignSelf: 'flex-end',
  textTransform: 'none',
  padding: 0,
  minWidth: 0,
  marginRight: 2,
  '&:active': {
    backgroundColor: '#585858',
  },
  '&.MuiButton-root': {
    color: theme => theme.palette.text.primary,
    '&:hover': {
      background: 'none',
      color: theme => theme.palette.text.secondary,
    },
  },
};

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  id: string;
  ariaControls: string;
  ariaLabel: string;
}

const MenuBarButton = ({
  onClick,
  children,
  id,
  ariaControls,
  ariaLabel,
}: IProps) => (
  <Button
    color="secondary"
    role="menu"
    size="small"
    aria-controls={ariaControls}
    id={id}
    aria-haspopup="true"
    onClick={onClick}
    aria-label={ariaLabel}
    sx={menuBarButtonSx}
  >
    {children}
  </Button>
);

const memoizedMenuBarButton = React.memo(MenuBarButton);

export {memoizedMenuBarButton as MenuBarButton};
