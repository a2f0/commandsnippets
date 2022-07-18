import Button from '@mui/material/Button';
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
  startIcon: React.ReactNode;
  role: string;
}

const LoginButton = React.forwardRef<HTMLButtonElement, IButtonItemProps>(
  ({id, onClick, children, role, startIcon}: IButtonItemProps) => {
    return (
      <Button
        id={id}
        role={role}
        size="small"
        variant="contained"
        color="secondary"
        disableElevation
        sx={theme => ({
          color: theme.palette.primary.main,
          margin: theme.spacing(0.75),
        })}
        onClick={onClick}
        startIcon={startIcon}
      >
        {children}
      </Button>
    );
  }
);

LoginButton.displayName = 'LoginButton';
export default LoginButton;
