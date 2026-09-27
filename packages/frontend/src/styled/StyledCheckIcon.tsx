import {Check} from '@mui/icons-material';
import React from 'react';

const StyledCheckIcon = () => {
  return (
    <Check fontSize="small" sx={{color: theme => theme.palette.text.primary}} />
  );
};

const memoizedStyledCheckIcon = React.memo(StyledCheckIcon);

export {memoizedStyledCheckIcon as StyledCheckIcon};
