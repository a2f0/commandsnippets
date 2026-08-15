import {Divider} from '@mui/material';
import React from 'react';

const StyledDivider = () => {
  return <Divider />;
};

const memoizedStyledDivider = React.memo(StyledDivider);

export {memoizedStyledDivider as StyledDivider};
