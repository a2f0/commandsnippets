import {Button} from '@mui/material';
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  'aria-busy'?: boolean;
}

export const StyledTagButton = React.forwardRef<
  HTMLButtonElement,
  IButtonItemProps
>(
  (
    {
      id,
      onClick,
      children,
      disabled = false,
      'aria-busy': busy,
    }: IButtonItemProps,
    ref
  ) => {
    const refValue = ref;
    return (
      <Button
        ref={refValue}
        id={id}
        disabled={disabled}
        aria-busy={busy}
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
  }
);

StyledTagButton.displayName = 'StyledTagButton';
