import * as Constants from '../../constants';
import {ClassNameMap, useTheme} from '@mui/styles';
import Button from '@mui/material/Button';
import React from 'react';
import {Theme} from '@mui/material/styles';
import makeStyles from '@mui/styles/makeStyles';

export enum Side {
  Left,
  Right,
}

interface IButtonItemProps {
  id: string;
  onClick: () => void;
  children?: React.ReactNode;
  side: Side;
}

const useStylesLeft = makeStyles({
  menuButton: {
    marginRight: `${Constants.tagButtonSpacing}px`,
  },
});

const useStylesRight = makeStyles({
  menuButton: {
    marginLeft: `${Constants.tagButtonSpacing}px`,
  },
});

export const StyledTagButton = ({
  id,
  onClick,
  children,
  side,
}: IButtonItemProps) => {
  const theme = useTheme<Theme>();

  const useStyledShared = makeStyles({
    shared: {
      borderRadius: 0,
      marginTop: '4px',
      border: `1px solid ${theme.palette.secondary.main}`,
      minWidth: `calc(50% - ${Constants.tagButtonSpacing}px)`,
    },
  });

  const sharedClasses = useStyledShared();
  let classes: ClassNameMap;

  if (side === Side.Left) {
    classes = useStylesLeft();
  } else {
    classes = useStylesRight();
  }

  return (
    <Button
      color="secondary"
      id={id}
      size="small"
      aria-controls="view-menu"
      className={`${classes.menuButton} ${sharedClasses.shared}`}
      aria-haspopup="true"
      onClick={onClick}
    >
      {children}
    </Button>
  );
};
