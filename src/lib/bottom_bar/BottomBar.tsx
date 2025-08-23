import {Box, Button, Menu, Tab, Tabs} from '@mui/material';
import {styled} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React, {useCallback, useState} from 'react';

import {TextEntrySearchField} from '../../styled/text_entries/TextEntrySearchField';
import {TagSearch} from '../../TagSearch';
import {environment} from '../environment';
import {Mode} from './Mode';
import {Version} from './Version';

const Aligner = styled('div')`
  display: flex;
`;

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
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        width: '100%',
        height: theme => theme.footer.height,
      }}
    >
      <Aligner>
        <TagSearch /> <TextEntrySearchField />
      </Aligner>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Mode />
        <Version />
        {environment !== 'production' && (
          <>
            <Button
              onClick={handleClick}
              aria-haspopup="true"
              aria-controls={open ? 'bottom-bar-menu' : undefined}
              aria-expanded={open}
              sx={{
                color: theme => theme.palette.text.primary,
                fontFamily: 'monospace',
                fontSize: theme => theme.typography.caption.fontSize,
                lineHeight: theme => theme.typography.caption.lineHeight,
                textTransform: 'none',
                minWidth: 'unset',
                padding: 0,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
            >
              [menu]
            </Button>
            <Menu
              id="bottom-bar-menu"
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
            >
              <Box
                sx={{
                  p: 1,
                  minWidth: 600,
                  minHeight: 300,
                  backgroundColor: theme => theme.palette.background.paper,
                  border: '1px solid',
                  borderColor: theme => theme.palette.divider,
                }}
              >
                <Tabs
                  value={selectedTab}
                  onChange={handleTabChange}
                  sx={{
                    minHeight: 'unset',
                    '& .MuiTab-root': {
                      minHeight: 'unset',
                      padding: '4px 8px',
                      fontSize: theme => theme.typography.caption.fontSize,
                      fontFamily: 'monospace',
                      color: theme => theme.palette.text.primary,
                      textTransform: 'none',
                      minWidth: 'unset',
                    },
                  }}
                >
                  <Tab label="Performance" />
                  <Tab label="Logs" />
                  <Tab label="Analytics" />
                </Tabs>
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
