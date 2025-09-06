import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import {Box, Button, IconButton, Menu, Tab, Tabs} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useState} from 'react';
import {LanguageSwitcher} from '../../components/LanguageSwitcher';
import {useErrorStore} from '../../hooks/useErrorStore';
import {useWindowSize} from '../../hooks/useWindowSize';
import {useTypedTranslation} from '../../i18n/hooks';
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

const BottomBar = () => {
  const {t} = useTypedTranslation('menu');
  const {width: windowWidth, height: windowHeight} = useWindowSize();
  const {logs, errors, getRecentLogs} = useErrorStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
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
        {environment !== 'production' && <LanguageSwitcher />}
        <Mode />
        <Version />
        {environment !== 'production' && (
          <>
            <Button
              onClick={handleClick}
              aria-label={t('openHudMenu')}
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
              [{t('hud')}]
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
                    width: isExpanded ? Math.min(windowWidth * 0.9, 1200) : 600,
                    height: isExpanded
                      ? Math.min(windowHeight * 0.8, 800)
                      : 400,
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    position: 'relative',
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
                  border: 1,
                  borderColor: 'divider',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Expand/Collapse button in top-right corner */}
                <IconButton
                  onClick={toggleExpanded}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    zIndex: 1,
                    backgroundColor: 'background.paper',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  aria-label={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
                >
                  {isExpanded ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
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
                  <Tab label={t('performance')} {...a11yProps(0)} />
                  <Tab label={t('logs')} {...a11yProps(1)} />
                  <Tab label={t('analytics')} {...a11yProps(2)} />
                </Tabs>
                <Box sx={{flex: 1, overflow: 'auto', height: '100%'}}>
                  <CustomTabPanel value={selectedTab} index={0}>
                    <Box sx={{color: 'text.secondary'}}>
                      {t('performanceMetrics')}
                      {isExpanded && (
                        <Box sx={{mt: 2}}>
                          {/* TODO: Replace with real performance metrics from application services */}
                          <div>CPU Usage: 45%</div>
                          <div>Memory: 2.3GB / 8GB</div>
                          <div>Network: 125 KB/s</div>
                        </Box>
                      )}
                    </Box>
                  </CustomTabPanel>
                  <CustomTabPanel value={selectedTab} index={1}>
                    <Box sx={{color: 'text.secondary'}}>
                      {isExpanded ? (
                        <Box
                          sx={{
                            mt: 2,
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            maxHeight: '300px',
                            overflow: 'auto',
                            backgroundColor: 'background.default',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1,
                          }}
                        >
                          {getRecentLogs(20).map(log => (
                            <Box
                              key={log.id}
                              sx={{
                                mb: 0.5,
                                color:
                                  log.level === 'ERROR'
                                    ? 'error.main'
                                    : log.level === 'WARN'
                                      ? 'warning.main'
                                      : log.level === 'DEBUG'
                                        ? 'text.disabled'
                                        : 'text.primary',
                              }}
                            >
                              <span>
                                [{log.timestamp.toLocaleTimeString()}]{' '}
                                {log.level}: {log.message}
                              </span>
                              {log.details && (
                                <details style={{marginLeft: '20px'}}>
                                  <summary
                                    style={{
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      opacity: 0.8,
                                    }}
                                  >
                                    Details
                                  </summary>
                                  <pre
                                    style={{
                                      fontSize: '0.75rem',
                                      margin: '5px 0',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {log.details}
                                  </pre>
                                </details>
                              )}
                            </Box>
                          ))}
                          {logs.length === 0 && (
                            <Box
                              sx={{color: 'text.disabled', fontStyle: 'italic'}}
                            >
                              No logs available
                            </Box>
                          )}
                        </Box>
                      ) : (
                        logs.length > 0 && (
                          <Box
                            sx={{
                              mt: 1,
                              fontSize: '0.875rem',
                              color: 'text.disabled',
                            }}
                          >
                            {logs.length} log entries • {errors.length} errors
                            captured
                          </Box>
                        )
                      )}
                    </Box>
                  </CustomTabPanel>
                  <CustomTabPanel value={selectedTab} index={2}>
                    <Box sx={{color: 'text.secondary'}}>
                      {t('analyticsData')}
                      {isExpanded && (
                        <Box sx={{mt: 2}}>
                          {/* TODO: Replace with real analytics data from analytics service */}
                          <div>Active Users: 127</div>
                          <div>Total Sessions: 3,452</div>
                          <div>Avg. Session Duration: 8m 34s</div>
                        </Box>
                      )}
                    </Box>
                  </CustomTabPanel>
                </Box>
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
