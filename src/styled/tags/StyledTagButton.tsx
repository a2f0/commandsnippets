import * as Constants from '../../constants';
import Button from '@mui/material/Button';
import {ClassNameMap} from '@mui/styles';
import React from 'react';
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

const useStyledShared = makeStyles({
  shared: {
    marginTop: '4px',
    marginBottom: '4px',
    minWidth: `calc(50% - ${Constants.tagButtonSpacing}px)`,
  },
});

export const StyledTagButton = ({
  id,
  onClick,
  children,
  side,
}: IButtonItemProps) => {
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
      variant="outlined"
      className={`${classes.menuButton} ${sharedClasses.shared}`}
      aria-haspopup="true"
      onClick={onClick}
    >
      {children}
    </Button>
  );
};
