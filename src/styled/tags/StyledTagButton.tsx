import Button from '@mui/material/Button';
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export const StyledTagButton = ({id, onClick, children}: IButtonItemProps) => {
  return (
    <Button
      color="secondary"
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
};
