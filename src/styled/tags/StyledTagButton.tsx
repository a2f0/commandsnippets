import Button from '@mui/material/Button';
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
}

const StyledTagButton = React.forwardRef<HTMLButtonElement, IButtonItemProps>(
  (props, ref) => {
    return (
      <Button
        ref={ref}
        color="secondary"
        id={props.id}
        size="small"
        aria-controls="view-menu"
        variant="outlined"
        aria-haspopup="true"
        onClick={props.onClick}
        sx={{
          display: 'flex',
          minWidth: '100%',
          marginTop: '4px',
          marginBottom: '4px',
        }}
      >
        {props.children}
      </Button>
    );
  }
);

StyledTagButton.displayName = 'StyledTagButton';
export default StyledTagButton;
