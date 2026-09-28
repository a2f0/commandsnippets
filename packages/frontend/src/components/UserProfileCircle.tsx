import {Person as PersonIcon} from '@mui/icons-material';
import {Avatar, Button, Divider, Menu, MenuItem} from '@mui/material';
import {styled} from '@mui/material/styles';
import {observer} from 'mobx-react';
import type React from 'react';
import {useState} from 'react';
import {useAppContext} from '../AppContext';
import {tearleadsApi} from '../lib/api/tearleadsApi';
import {environment} from '../lib/environment';
import {resetApplicationState} from '../lib/store/store';

const StyledButton = styled(Button)(({theme}) => ({
  alignSelf: 'flex-end',
  textTransform: 'none',
  padding: 0,
  minWidth: 0,
  marginRight: 1,
  '&:active': {
    backgroundColor: theme.palette.action.active,
  },
  '&.MuiButton-root': {
    color: theme.palette.text.primary,
    '&:hover': {
      background: 'none',
      '& .MuiAvatar-root': {
        backgroundColor: theme.palette.text.secondary,
      },
    },
  },
}));

const StyledAvatar = styled(Avatar)(({theme}) => ({
  width: 32,
  height: 32,
  backgroundColor: theme.palette.text.primary,
  fontSize: '14px',
  transition: 'background-color 0.2s',
}));

const StyledMenu = styled(Menu)(({theme}) => ({
  '& .MuiPaper-root': {
    marginTop: theme.spacing(0.5),
    minWidth: 180,
  },
}));

const UserProfileCircle: React.FC = () => {
  const appConfig = useAppContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await tearleadsApi.logout();
    } catch (error: unknown) {
      console.error('Logout error:', error);
    } finally {
      resetApplicationState();
      handleClose();
    }
  };

  const handleProfile = () => {
    // TODO: Navigate to profile page
    handleClose();
  };

  const handleSettings = () => {
    // TODO: Navigate to settings page
    handleClose();
  };

  const getUserInitials = () => {
    const username = appConfig.loggedInUser;
    if (!username) return '';

    // If username has spaces, use first and last initials
    const names = username.split(' ');
    const lastIndex = names.length - 1;
    if (names.length >= 2 && names[0] && names[lastIndex]) {
      return `${names[0][0]}${names[lastIndex][0]}`.toUpperCase();
    }
    // Otherwise use first two characters of username
    return username.slice(0, 2).toUpperCase();
  };

  const username = appConfig.loggedInUser;

  // Only show in non-production environments
  if (!username || environment === 'production') {
    return null;
  }

  return (
    <>
      <StyledButton
        onClick={handleClick}
        color="secondary"
        size="small"
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        aria-label={username || 'User menu'}
      >
        <StyledAvatar>
          {getUserInitials() || <PersonIcon sx={{fontSize: 18}} />}
        </StyledAvatar>
      </StyledButton>

      <StyledMenu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{horizontal: 'right', vertical: 'top'}}
        anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
        slotProps={{
          transition: {
            timeout: 0,
          },
        }}
      >
        <MenuItem disabled sx={{fontSize: 'caption.fontSize', fontWeight: 500}}>
          {username}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleProfile}
          sx={theme => ({
            fontSize: 'caption.fontSize',
            background: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.selected.background,
            },
          })}
        >
          Profile
        </MenuItem>
        <MenuItem
          onClick={handleSettings}
          sx={theme => ({
            fontSize: 'caption.fontSize',
            background: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.selected.background,
            },
          })}
        >
          Settings
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={handleLogout}
          sx={theme => ({
            fontSize: 'caption.fontSize',
            background: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.selected.background,
            },
          })}
        >
          Logout
        </MenuItem>
      </StyledMenu>
    </>
  );
};

const ObservedUserProfileCircle = observer(UserProfileCircle);

export {ObservedUserProfileCircle as UserProfileCircle};
