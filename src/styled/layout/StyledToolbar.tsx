import React from 'react';
import Toolbar from '@mui/material/Toolbar';
import makeStyles from '@mui/styles/makeStyles';

interface IProps {
  children?: React.ReactNode;
}

const useStyles = makeStyles({
  toolBar: {
    padding: 0,
  },
});

const StyledToolbar = ({children}: IProps) => {
  const classes = useStyles();

  return (
    <Toolbar variant="dense" className={classes.toolBar}>
      {children}
    </Toolbar>
  );
};

export default StyledToolbar;
