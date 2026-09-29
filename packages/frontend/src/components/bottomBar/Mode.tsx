import {Typography} from '@mui/material';
import React from 'react';

import {useAppConfig} from '../../lib/state/appState';

const Mode = () => {
  const appConfig = useAppConfig();
  return (
    <Typography
      variant="caption"
      sx={{
        fontFamily: 'monospace',
        mr: theme => theme.spacing(0.5),
        color: theme => theme.palette.text.primary,
      }}
    >
      [mode: {appConfig.appMode}]
    </Typography>
  );
};

const memoizedMode = React.memo(Mode);

export {memoizedMode as Mode};
