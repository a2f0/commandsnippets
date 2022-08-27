import Button from '@mui/material/Button';
import React from 'react';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  id: string;
  ariaControls: string;
  ariaLabel: string;
}

const MenuBarButton = function ({
  onClick,
  children,
  id,
  ariaControls,
  ariaLabel,
}: IProps) {
  return (
    <Button
      color="secondary"
      role="menu"
      size="small"
      aria-controls={ariaControls}
      id={id}
      aria-haspopup="true"
      onClick={onClick}
      aria-label={ariaLabel}
      sx={{
        alignSelf: 'flex-end',
        textTransform: 'none',
        padding: 0,
        minWidth: 0,
        marginRight: 2,
        '&:hover': {
          color: theme => `${theme.header.menuButtonHighlight}`,
          background: 'none',
        },
        '&:active': {
          backgroundColor: '#585858',
        },
      }}
    >
      {children}
    </Button>
  );
};
export default React.memo(MenuBarButton);
