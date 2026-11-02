import MoreVert from '@mui/icons-material/MoreVert';
import {Chip, IconButton, TableCell, TableRow, Tooltip} from '@mui/material';
import type React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import type {AdminUser} from '../../lib/api/adminApi';
import {formatTimestamp} from '../../lib/formatTimestamp';
import type {IMouse} from '../../lib/shared';

interface IProps {
  user: AdminUser;
  /** The signed-in user's own row: no actions. */
  isSelf: boolean;
  /** Opens the user's actions menu below their actions button. */
  onOpenMenu: (user: AdminUser, at: IMouse) => void;
  /** Opens the user's actions menu where the row was right-clicked. */
  onContextMenu: (user: AdminUser, event: React.MouseEvent) => void;
}

const StatusChip = ({user}: {user: AdminUser}) => {
  const {t} = useTypedTranslation('admin');
  if (user.dateMarkedForDeletion !== null) {
    return <Chip size="small" color="error" label={t('markedForDeletion')} />;
  }
  return (
    <Chip
      size="small"
      color={user.isActive ? 'success' : 'default'}
      label={user.isActive ? t('active') : t('inactive')}
    />
  );
};

/** A user in the admin users table. */
export const AdminUserRow = ({
  user,
  isSelf,
  onOpenMenu,
  onContextMenu,
}: IProps) => {
  const {t, i18n} = useTypedTranslation('admin');
  const formatDate = (value: string | null) =>
    value === null ? t('never') : formatTimestamp(value, i18n.language);

  const openFromButton = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onOpenMenu(user, {mouseX: rect.left, mouseY: rect.bottom});
  };

  return (
    <TableRow
      id={`adminUserRow${user.id}`}
      onContextMenu={isSelf ? undefined : event => onContextMenu(user, event)}
    >
      <TableCell>
        {user.username}
        {user.isStaff && (
          <Chip
            label={t('staff')}
            size="small"
            variant="outlined"
            sx={{ml: 1}}
          />
        )}
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{formatDate(user.dateJoined)}</TableCell>
      <TableCell>{formatDate(user.lastLogin)}</TableCell>
      <TableCell>{formatDate(user.lastActive)}</TableCell>
      <TableCell align="right">{user.loginCount}</TableCell>
      <TableCell align="right">{user.entryCount}</TableCell>
      <TableCell align="right">{user.tagCount}</TableCell>
      <TableCell>
        <StatusChip user={user} />
      </TableCell>
      <TableCell align="right">
        <Tooltip title={isSelf ? t('cannotChangeSelf') : ''}>
          <span>
            <IconButton
              id={`adminUserMenuButton${user.id}`}
              size="small"
              aria-label={t('userActions', {username: user.username})}
              aria-haspopup="menu"
              disabled={isSelf}
              onClick={openFromButton}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};
