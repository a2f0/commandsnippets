import {Box, Button, Menu, Tab, Tabs} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useState} from 'react';

import {TextEntrySearchField} from '../../styled/text_entries/TextEntrySearchField';
import {TagSearch} from '../../TagSearch';
import {environment} from '../environment';
import {Mode} from './Mode';
import {Version} from './Version';

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

const BottomBar = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTab, setSelectedTab] = useState(0);
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

  return (
    <Box
      data-testid="bottom-bar-main-container"
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        width: '100%',
        height: theme => theme.footer.height,
      }}
    >
      <Box
        data-testid="bottom-bar-left-container"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <TagSearch />
        <TextEntrySearchField />
      </Box>
      <Box
        data-testid="bottom-bar-right-container"
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
        }}
      >
        <Mode />
        <Version />
        {environment !== 'production' && (
          <>
            <Button
              onClick={handleClick}
              aria-label="Open HUD menu"
              aria-haspopup="true"
              aria-controls={open ? 'hud-menu' : undefined}
              aria-expanded={open}
              sx={{
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
              }}
            >
              [HUD]
            </Button>
            <Menu
              id="hud-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              slotProps={{
                paper: {
                  sx: {
                    minWidth: 600,
                    maxWidth: '80vw',
                    maxHeight: '60vh',
                  },
                },
                transition: {
                  timeout: 0,
                },
              }}
            >
              <Box
                sx={{
                  p: 1,
                  backgroundColor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Tabs
                  value={selectedTab}
                  onChange={handleTabChange}
                  aria-label="HUD navigation tabs"
                  sx={{
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
                  }}
                >
                  <Tab label="Performance" {...a11yProps(0)} />
                  <Tab label="Logs" {...a11yProps(1)} />
                  <Tab label="Analytics" {...a11yProps(2)} />
                </Tabs>
                <CustomTabPanel value={selectedTab} index={0}>
                  <Box sx={{minHeight: 200, color: 'text.secondary'}}>
                    Performance metrics will be displayed here
                  </Box>
                </CustomTabPanel>
                <CustomTabPanel value={selectedTab} index={1}>
                  <Box sx={{minHeight: 200, color: 'text.secondary'}}>
                    Application logs will be displayed here
                  </Box>
                </CustomTabPanel>
                <CustomTabPanel value={selectedTab} index={2}>
                  <Box sx={{minHeight: 200, color: 'text.secondary'}}>
                    Analytics data will be displayed here
                  </Box>
                </CustomTabPanel>
              </Box>
            </Menu>
          </>
        )}
      </Box>
    </Box>
  );
};

const memoizedBottomBar = React.memo(observer(BottomBar));
export {memoizedBottomBar as BottomBar};
