import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import {Box, Button, IconButton, Menu, Tab, Tabs} from '@mui/material';
import React, {Suspense, useCallback, useState} from 'react';
import {useWindowSize} from '../../hooks/useWindowSize';
import {useTypedTranslation} from '../../i18n/hooks';
import {HudLogs} from './HudLogs';

// The Analytics tab's charts load when the tab is first shown: only
// pages with the `hud` flag on (not production by default) have a HUD, so the app's own bundle leaves them out.
const TimingAnalytics = React.lazy(() =>
  import('./analytics/TimingAnalytics').then(module => ({
    default: module.TimingAnalytics,
  }))
);

/** How far the expanded HUD keeps from the window's edges, in px. */
const EXPANDED_MARGIN = 16;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const CustomTabPanel = React.memo((props: TabPanelProps) => {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`hud-tabpanel-${index}`}
      aria-labelledby={`hud-tab-${index}`}
      style={{
        height: '100%',
        backgroundColor: 'transparent',
      }}
      {...other}
    >
      {value === index && <Box sx={{p: 2}}>{children}</Box>}
    </div>
  );
});

CustomTabPanel.displayName = 'CustomTabPanel';

const a11yProps = (index: number) => ({
  id: `hud-tab-${index}`,
  'aria-controls': `hud-tabpanel-${index}`,
});

const hudButtonSx = {
  color: 'text.primary',
  fontFamily: 'monospace',
  fontSize: 'caption.fontSize',
  lineHeight: 'caption.lineHeight',
  textTransform: 'none',
  minWidth: 'unset',
  padding: 0,
  '&:hover': {
    backgroundColor: 'transparent',
    textDecoration: 'underline',
  },
};

const expandButtonSx = {
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 1,
  backgroundColor: 'background.paper',
  '&:hover': {
    backgroundColor: 'action.hover',
  },
};

const tabsSx = {
  minHeight: 'unset',
  borderBottom: 1,
  borderColor: 'divider',
  '& .MuiTab-root': {
    minHeight: 'unset',
    padding: '8px 16px',
    fontSize: 'caption.fontSize',
    fontFamily: 'monospace',
    color: 'text.secondary',
    textTransform: 'none',
    minWidth: 'unset',
    transition: 'none',
    '&.Mui-selected': {
      color: 'text.primary',
    },
  },
  '& .MuiTabs-indicator': {
    transition: 'none',
  },
};

const menuContentSx = {
  p: 1,
  border: 1,
  borderColor: 'divider',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
};

/** The size of the HUD's menu: nearly the whole window when expanded, for the timing charts. */
const usePaperSx = (isExpanded: boolean) => {
  const {width, height} = useWindowSize();
  return {
    width: isExpanded ? Math.max(600, width - 2 * EXPANDED_MARGIN) : 600,
    height: isExpanded ? Math.max(400, height - 2 * EXPANDED_MARGIN) : 400,
    maxWidth: `calc(100vw - ${2 * EXPANDED_MARGIN}px)`,
    maxHeight: `calc(100vh - ${2 * EXPANDED_MARGIN}px)`,
    overflow: 'hidden',
    position: 'relative',
  };
};

/** The HUD: its button in the bottom bar, and the Logs and Analytics tabs it opens. */
export const HudMenu = () => {
  const {t} = useTypedTranslation('menu');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const paperSx = usePaperSx(isExpanded);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      setSelectedTab(newValue);
    },
    []
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <>
      <Button
        onClick={handleClick}
        aria-label={t('openHudMenu')}
        aria-haspopup="true"
        aria-controls={open ? 'hud-menu' : undefined}
        aria-expanded={open}
        sx={hudButtonSx}
      >
        [{t('hud')}]
      </Button>
      <Menu
        id="hud-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{vertical: 'top', horizontal: 'left'}}
        transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
        slotProps={{paper: {sx: paperSx}, transition: {timeout: 0}}}
      >
        <Box sx={menuContentSx}>
          <IconButton
            onClick={toggleExpanded}
            size="small"
            sx={expandButtonSx}
            aria-label={isExpanded ? t('collapseHud') : t('expandHud')}
          >
            {isExpanded ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            aria-label="HUD navigation tabs"
            sx={tabsSx}
          >
            <Tab label={t('logs')} {...a11yProps(0)} />
            <Tab label={t('analytics')} {...a11yProps(1)} />
          </Tabs>
          <Box sx={{flex: 1, overflow: 'auto', height: '100%'}}>
            <CustomTabPanel value={selectedTab} index={0}>
              <Box sx={{color: 'text.secondary'}}>
                <HudLogs isExpanded={isExpanded} />
              </Box>
            </CustomTabPanel>
            <CustomTabPanel value={selectedTab} index={1}>
              <Suspense fallback={null}>
                <TimingAnalytics />
              </Suspense>
            </CustomTabPanel>
          </Box>
        </Box>
      </Menu>
    </>
  );
};
