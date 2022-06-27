import React from 'react';
import Toolbar from '@mui/material/Toolbar';

interface IProps {
  children?: React.ReactNode;
}

const StyledToolbar = ({children}: IProps) => {
  return (
    <Toolbar variant="dense" disableGutters={true}>
      {children}
    </Toolbar>
  );
};

export default StyledToolbar;
