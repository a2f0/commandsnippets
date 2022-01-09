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
      sx={{
        fontSize: 13,
      }}
    >
      {children}
    </MenuItem>
  );
};
export default React.memo(StyledMenuItem);
