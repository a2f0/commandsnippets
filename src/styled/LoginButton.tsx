import {Button} from '@mui/material';
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
  startIcon: React.ReactNode;
  role: string;
}

const LoginButton = ({
  id,
  onClick,
  children,
  role,
  startIcon,
}: IButtonItemProps) => {
  return (
    <Button
      id={id}
      role={role}
      size="small"
      variant="contained"
      disableElevation
      sx={theme => ({
        color: theme.palette.background.default,
        backgroundColor: theme.palette.text.primary,
        margin: theme.spacing(0.75),
        '&:hover': {
          backgroundColor: theme.palette.grey['600'],
        },
      })}
      onClick={onClick}
      startIcon={startIcon}
    >
      {children}
    </Button>
  );
};

export default LoginButton;
