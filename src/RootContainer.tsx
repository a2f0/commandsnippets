import React from 'react';
import {makeStyles} from '@material-ui/core/styles';

interface IRootContainerProps {
  children?: React.ReactNode;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
  },
});

const RootContainer = ({children}: IRootContainerProps) => {
  const classes = useStyles();

  return (
    <div className={classes.root} id="root-container">
      {children}
    </div>
  );
};

export default React.memo(RootContainer);
