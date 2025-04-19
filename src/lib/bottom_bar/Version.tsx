import {Typography} from '@mui/material';
import {observer} from 'mobx-react';
import React from 'react';

import packageJson from '../../../package.json';

const Version = () => {
  return (
    <Typography
      variant="caption"
      fontFamily="monospace"
      sx={{
        mr: theme => theme.spacing(0.5),
        color: theme => theme.palette.text.primary,
      }}
    >
      [version: {packageJson.version}]
    </Typography>
  );
};

const memoizedVersion = React.memo(observer(Version));
export {memoizedVersion as Version};
