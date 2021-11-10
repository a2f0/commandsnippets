import MenuItem from '@mui/material/MenuItem';
import React from 'react';

interface IProps {
  children?: React.ReactNode;
  onClick: () => void;
}

const StyledMenuItem = ({children, onClick}: IProps) => {
  return (
    <MenuItem
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
