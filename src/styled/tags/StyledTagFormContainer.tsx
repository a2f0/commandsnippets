import * as Constants from '../../constants';
import Box from '@mui/material/Box';
import React from 'react';

interface IProps {
  children?: React.ReactNode;
  id: string;
}

const StyledTagFormContainer = ({children, id}: IProps) => {
  return (
    <Box
      id={id}
      sx={{
        width: theme => `100% - ${theme.main.dragIndicatorWidth}px`,
        ml: theme => `${theme.main.dragIndicatorWidth}px`,
      }}
    >
      {children}
    </Box>
  );
};
export default React.memo(StyledTagFormContainer);
