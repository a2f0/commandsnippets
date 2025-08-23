import {Box, Button, Menu, MenuItem} from '@mui/material';
import Grid from '@mui/material/Grid';
import {styled} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React, {useState} from 'react';
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
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Aligner>
        <TagSearch /> <TextEntrySearchField />
      </Aligner>
      <Grid
        container
        justifyContent="flex-end"
        flex={1}
        sx={{
          height: theme => theme.footer.height,
        }}
      >
        <Box
          sx={{
            height: theme => theme.footer.height,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
          }}
        >
          <Mode />
          {environment !== 'production' && (
            <>
              <Button
                onClick={handleClick}
                aria-haspopup="true"
                aria-controls={open ? 'bottom-bar-menu' : undefined}
                aria-expanded={open}
                sx={{
                  mr: theme => theme.spacing(0.5),
                  color: theme => theme.palette.text.primary,
                  fontFamily: 'monospace',
                  fontSize: theme => theme.typography.caption.fontSize,
                  lineHeight: theme => theme.typography.caption.lineHeight,
                  textTransform: 'none',
                  minWidth: 'unset',
                  padding: 0,
                  alignSelf: 'flex-end',
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
                <MenuItem onClick={handleClose} disabled>
                  Profile
                </MenuItem>
                <MenuItem onClick={handleClose} disabled>
                  Settings
                </MenuItem>
                <MenuItem onClick={handleClose} disabled>
                  Help
                </MenuItem>
                <MenuItem onClick={handleClose} disabled>
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}
          <Version />
        </Box>
      </Grid>
    </>
  );
};

const memoizedBottomBar = React.memo(observer(BottomBar));
export {memoizedBottomBar as BottomBar};
