import {Typography} from '@mui/material';
import React from 'react';

import packageJson from '../../../package.json';

const Version = () => {
  return (
    <Typography
      variant="caption"
      sx={{
        fontFamily: 'monospace',
        mr: theme => theme.spacing(0.5),
        color: theme => theme.palette.text.primary,
      }}
    >
      [version: {packageJson.version}]
    </Typography>
  );
};

const memoizedVersion = React.memo(Version);

export {memoizedVersion as Version};
