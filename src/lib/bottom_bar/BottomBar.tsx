import {Box, Button, Menu, MenuItem} from '@mui/material';
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

const BottomBarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const BottomBar = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return (
    <BottomBarContainer>
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
        {/* <TagCount /> */}
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
              <MenuItem disabled>Profile</MenuItem>
              <MenuItem disabled>Settings</MenuItem>
              <MenuItem disabled>Help</MenuItem>
              <MenuItem disabled>Logout</MenuItem>
            </Menu>
          </>
        )}
        <Version />
      </Box>
    </BottomBarContainer>
  );
};

const memoizedBottomBar = React.memo(observer(BottomBar));
export {memoizedBottomBar as BottomBar};
