import {MenuItem} from '@mui/material';
import React from 'react';

interface IProps {
  id: string;
  children?: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLLIElement>) => void;
}

const StyledMenuItem = ({children, onClick, id}: IProps) => {
  return (
    <MenuItem
      id={id}
      onClick={onClick}
      sx={theme => ({
        fontSize: 13,
        background: theme.palette.background.default,
        '&:hover': {
          backgroundColor:
            theme.selected.background ||
            theme.palette.action?.hover ||
            'rgba(255, 255, 255, 0.08)',
        },
      })}
    >
      {children}
    </MenuItem>
  );
};

const memoizedStyledMenuItem = React.memo(StyledMenuItem);
export {memoizedStyledMenuItem as StyledMenuItem};
