import {Box} from '@mui/material';
import type {ReactNode} from 'react';
import {useWindowSize} from '../../hooks/useWindowSize';
import {clampSidebarWidth, maxSidebarWidth} from '../../lib/sidebarWidth';
import {useAppState} from '../../lib/state/appState';

/** Resize the layout without rendering the lists again for every pointer move. */
export const TagSidebarLayout = ({children}: {children: ReactNode}) => {
  const width = useAppState(state => state.tagSidebarWidth);
  const {width: viewportWidth} = useWindowSize();
  return (
    <Box
      sx={{
        '--tag-sidebar-width': `${clampSidebarWidth(width, maxSidebarWidth(viewportWidth))}px`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {children}
    </Box>
  );
};
