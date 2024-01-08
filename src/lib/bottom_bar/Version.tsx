import React from 'react';
import {Typography} from '@mui/material';
import {observer} from 'mobx-react';
import packageJson from '../../../package.json';

const BottomBar = () => {
  return (
    <Typography
      variant="subtitle2"
      sx={{
        mr: theme => theme.spacing(0.5),
      }}
    >
      [{packageJson.version}]
    </Typography>
  );
};
export default React.memo(observer(BottomBar));
