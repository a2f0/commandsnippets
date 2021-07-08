import {Theme, createStyles, makeStyles} from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import React from 'react';
import {useTheme} from '@material-ui/styles';

interface IStyledMenuProps {
  id: string;
  children: string;
  onClick: () => void;
}

const StyledButtonSmall = ({id, children, onClick}: IStyledMenuProps) => {
  const theme = useTheme<Theme>();
  const useStyles = makeStyles(() =>
    createStyles({
      button: {
        display: 'inline-block',
        borderRadius: 0,
        border: `1px solid ${theme.palette.secondary.main}`,
        width: '50%',
        padding: 0,
      },
    })
  );
  const classes = useStyles();
  return (
    <Button id={id} onClick={onClick} className={classes.button}>
      {children}
    </Button>
  );
};

export default React.memo(StyledButtonSmall);
