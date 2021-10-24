import * as Constants from '../../constants';
import {ClassNameMap, useTheme} from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import React from 'react';
import {Theme} from '@material-ui/core/styles';
import {makeStyles} from '@material-ui/core/styles';

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
