import Button from '@material-ui/core/Button';
import React from 'react';
import {Theme} from '@material-ui/core/styles';
import {makeStyles} from '@material-ui/core/styles';
import {useTheme} from '@material-ui/styles';

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export const StyledTagButton = ({id, onClick, children}: IButtonItemProps) => {
  const theme = useTheme<Theme>();
  const useStyles = makeStyles({
    menuButton: {
      minWidth: 'calc(100% / 2)',
      border: `1px solid ${theme.palette.secondary.main}`,
      borderRadius: 0,
    },
  });
  const classes = useStyles();
  return (
    <Button
      id={id}
      size="small"
      aria-controls="view-menu"
      className={classes.menuButton}
      aria-haspopup="true"
      onClick={onClick}
    >
      {children}
    </Button>
  );
};
