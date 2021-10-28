import * as Constants from '../../constants';
import React from 'react';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles({
  container: {
    marginLeft: `${Constants.dragIndicatorWidthTag}px`,
    width: `100% - ${Constants.dragIndicatorWidthTag}px`,
  },
});

interface IProps {
  children?: React.ReactNode;
}

const StyledTagFormContainer = ({children}: IProps) => {
  const classes = useStyles();
  return <div className={classes.container}>{children}</div>;
};
export default React.memo(StyledTagFormContainer);
