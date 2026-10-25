import {Box} from '@mui/material';
import invariant from 'invariant';
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import {useWindowSize} from '../../hooks/useWindowSize';
import {clampSidebarWidth, maxSidebarWidth} from '../../lib/sidebarWidth';
import {useAppState} from '../../lib/state/appState';

interface SidebarSizing {
  width: number;
  maximum: number;
  preview: (width: number | null) => void;
}

const SidebarContext = createContext<SidebarSizing | null>(null);

export const useSidebarSizing = (): SidebarSizing => {
  const sizing = useContext(SidebarContext);
  invariant(sizing, 'The sidebar must be inside TagSidebarLayout');
  return sizing;
};

/** Resize the layout without rendering the lists again for every pointer move. */
export const TagSidebarLayout = ({children}: {children: ReactNode}) => {
  const savedWidth = useAppState(state => state.tagSidebarWidth);
  const [previewWidth, preview] = useState<number | null>(null);
  const {width: viewportWidth} = useWindowSize();
  const maximum = maxSidebarWidth(viewportWidth);
  const width = clampSidebarWidth(previewWidth ?? savedWidth, maximum);
  const sizing = useMemo(() => ({width, maximum, preview}), [width, maximum]);
  const style: CSSProperties & {'--tag-sidebar-width': string} = {
    '--tag-sidebar-width': `${width}px`,
  };
  return (
    <SidebarContext value={sizing}>
      <Box
        style={style}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </SidebarContext>
  );
};
