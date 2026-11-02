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
  const refValue = ref;
  return (
    <Button
      ref={refValue}
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
      }}
    >
      {children}
    </Button>
  );
});

StyledTagButton.displayName = 'StyledTagButton';
