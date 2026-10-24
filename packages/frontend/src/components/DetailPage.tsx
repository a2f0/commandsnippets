import {ArrowBack} from '@mui/icons-material';
import {Box, Button} from '@mui/material';
import type {ReactNode} from 'react';
import {Link} from '../lib/router/Router';
import {AppHeader} from './AppHeader';
import {InitialLoadProgress} from './entries/InitialLoadProgress';
import {RobotsNoindex} from './RobotsNoindex';

/** Shared navigation and responsive canvas for entry details and activity. */
export const DetailPage = ({
  id,
  backTo,
  backLabel,
  syncStatus,
  children,
}: {
  id: string;
  backTo: string;
  backLabel: string;
  syncStatus: {failed: boolean; retry: () => void};
  children: ReactNode;
}) => (
  <Box sx={{minHeight: '100vh'}}>
    <RobotsNoindex />
    <AppHeader entriesPage={false} />
    <InitialLoadProgress {...syncStatus} />
    <Box
      component="main"
      id={id}
      sx={{maxWidth: 1120, mx: 'auto', px: {xs: 2, sm: 4}, py: 3, minWidth: 0}}
    >
      <Box
        component="nav"
        sx={{mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider'}}
      >
        <Button
          id={id === 'entryPage' ? 'entryBack' : 'reusesBack'}
          component={Link}
          to={backTo}
          startIcon={<ArrowBack fontSize="small" />}
          sx={{color: 'text.secondary', px: 1, ml: -1, minHeight: 40}}
        >
          {backLabel}
        </Button>
      </Box>
      {children}
    </Box>
  </Box>
);
