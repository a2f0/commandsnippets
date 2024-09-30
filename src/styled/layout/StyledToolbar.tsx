import {Toolbar} from '@mui/material';
import React from 'react';

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
