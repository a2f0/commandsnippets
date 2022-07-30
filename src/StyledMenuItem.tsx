import MenuItem from '@mui/material/MenuItem';
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
          backgroundColor: theme.selected.background,
        },
      })}
    >
      {children}
    </MenuItem>
  );
};
export default React.memo(StyledMenuItem);
