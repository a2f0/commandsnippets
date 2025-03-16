import {Button} from '@mui/material';
// biome-ignore lint: style/useImportType
import React from 'react';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
  startIcon: React.ReactNode;
}

const LoginButton = ({id, onClick, children, startIcon}: IButtonItemProps) => {
  return (
    <Button
      id={id}
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
