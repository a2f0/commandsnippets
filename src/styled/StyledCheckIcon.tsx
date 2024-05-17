import {Check} from '@mui/icons-material';
import React from 'react';

const StyledCheckIcon = () => {
  return (
    <Check fontSize="small" sx={{color: theme => theme.palette.text.primary}} />
  );
};

export default React.memo(StyledCheckIcon);
