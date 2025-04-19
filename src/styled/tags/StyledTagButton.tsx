import {Button} from '@mui/material';
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export const StyledTagButton = React.forwardRef<
  HTMLButtonElement,
  IButtonItemProps
>(({id, onClick, children}: IButtonItemProps, ref) => {
  return (
    <Button
      ref={ref}
      id={id}
      size="small"
      aria-controls="view-menu"
      variant="outlined"
      aria-haspopup="true"
      onClick={onClick}
      sx={{
        display: 'flex',
        minWidth: '100%',
        marginTop: '4px',
        marginBottom: '4px',
        color: theme => theme.palette.text.primary,
        borderColor: theme => theme.palette.text.secondary,
        '&:hover': {
          borderColor: theme => theme.palette.text.primary,
        },
      }}
    >
      {children}
    </Button>
  );
});

StyledTagButton.displayName = 'StyledTagButton';
