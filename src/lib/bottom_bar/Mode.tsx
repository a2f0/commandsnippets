import React from 'react';
import {Typography} from '@mui/material';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';

const Mode = () => {
  const appConfig = useAppContext();
  return (
    <Typography
      variant="caption"
      fontFamily="monospace"
      sx={{
        mr: theme => theme.spacing(0.5),
        color: theme => theme.palette.text.primary,
      }}
    >
      [mode: {appConfig.appMode}]
    </Typography>
  );
};
export default React.memo(observer(Mode));
