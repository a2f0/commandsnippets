import {Toolbar} from '@mui/material';
import type React from 'react';

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

export {StyledToolbar};
