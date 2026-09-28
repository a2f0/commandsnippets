import {Button} from '@mui/material';
import React from 'react';

import {menuBarButtonSx} from '../theme/sx';

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
