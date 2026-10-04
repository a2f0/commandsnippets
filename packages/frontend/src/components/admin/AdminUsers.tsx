import {MoreVert} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import React, {useCallback, useEffect, useState} from 'react';

import type {AdminKeys} from '../../i18n/hooks';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  AdminApiError,
  AdminForbiddenError,
  type AdminPage,
  type AdminUser,
  type AdminUserSortField,
  type AdminUserStatus,
  type AdminUsersQuery,
  listUsers,
  setUserActive,
  setUserMarkedForDeletion,
} from '../../lib/api/adminApi';
import {UserMismatchError} from '../../lib/api/apiClient';
import {formatTimestamp} from '../../lib/formatTimestamp';
import {navigate} from '../../lib/router/navigation';
import {type IMouse, initialMouse} from '../../lib/shared';
import {leaveForeignSession} from '../../lib/state/appState';
import {commonButtonSx} from '../../theme/sx';
import {
  type AdminUserAction,
  type AdminUserChange,
  AdminUserContextMenu,
} from './AdminUserContextMenu';

const PAGE_SIZES = [25, 50, 100];
const SEARCH_DELAY_MS = 300;

interface Column {
  label: AdminKeys;
  sort: AdminUserSortField | null;
  numeric: boolean;
}

const COLUMNS: Column[] = [
  {label: 'columnUsername', sort: 'username', numeric: false},
  {label: 'columnEmail', sort: 'email', numeric: false},
  {label: 'columnJoined', sort: 'date_joined', numeric: false},
  {label: 'columnLastLogin', sort: 'last_login', numeric: false},
  {label: 'columnLastActive', sort: 'last_active', numeric: false},
  {label: 'columnLogins', sort: 'login_count', numeric: true},
  {label: 'columnEntries', sort: 'entry_count', numeric: true},
  {label: 'columnTags', sort: 'tag_count', numeric: true},
  {label: 'columnStatus', sort: null, numeric: false},
];

interface ActionDialog {
  title: AdminKeys;
  body: AdminKeys;
  destructive: boolean;
}

const ACTION_DIALOGS: Record<AdminUserChange, ActionDialog> = {
  deactivate: {
    title: 'deactivateTitle',
    body: 'deactivateBody',
    destructive: true,
  },
  reactivate: {
    title: 'reactivateTitle',
    body: 'reactivateBody',
    destructive: false,
  },
  markForDeletion: {
    title: 'markForDeletionTitle',
    body: 'markForDeletionBody',
    destructive: true,
  },
  unmarkForDeletion: {
    title: 'unmarkForDeletionTitle',
    body: 'unmarkForDeletionBody',
    destructive: false,
  },
};

/** Deactivating and marking for deletion both end the user's sessions. */
function applyAction(user: AdminUser, action: AdminUserChange) {
  switch (action) {
    case 'deactivate':
      return setUserActive(user.id, false);
    case 'reactivate':
      return setUserActive(user.id, true);
    case 'markForDeletion':
      return setUserMarkedForDeletion(user.id, true);
    case 'unmarkForDeletion':
      return setUserMarkedForDeletion(user.id, false);
  }
}

interface IProps {
  currentUsername: string | null;
  /** The API said the viewer is not staff (revoked since the page loaded). */
  onForbidden: () => void;
}

const AdminUsers = ({currentUsername, onForbidden}: IProps) => {
  const {t, i18n} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<AdminUsersQuery>({
    search: '',
    status: 'all',
    sort: 'date_joined',
    descending: true,
    page: 1,
    pageSize: PAGE_SIZES[0] ?? 25,
  });
  const [users, setUsers] = useState<AdminPage<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState<{
    user: AdminUser;
    action: AdminUserChange;
  } | null>(null);
  // The menu keeps its user while it closes; the position opens and closes it.
  const [menuUser, setMenuUser] = useState<AdminUser | null>(null);
  const [menuMouse, setMenuMouse] = useState<IMouse>(initialMouse);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Search as the admin types, once they pause.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(current =>
        current.search === searchInput
          ? current
          : {...current, search: searchInput, page: 1}
      );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // A new query object (including a copy, to retry) loads that page.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    listUsers(query, controller.signal)
      .then(result => setUsers(result))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof AdminForbiddenError) {
          onForbidden();
          return;
        }
        // The page no longer exists (a change emptied the last one).
        if (
          error instanceof AdminApiError &&
          error.status === 404 &&
          query.page > 1
        ) {
          setQuery(current => ({...current, page: current.page - 1}));
          return;
        }
        console.error('Loading users failed:', error);
        setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, onForbidden]);

  const sortBy = (field: AdminUserSortField) => {
    setQuery(current => ({
      ...current,
      sort: field,
      // A new column starts with the most useful end first.
      descending:
        field === current.sort
          ? !current.descending
          : field !== 'username' && field !== 'email',
      page: 1,
    }));
  };

  const openMenu = (user: AdminUser, mouse: IMouse) => {
    setMenuUser(user);
    setMenuMouse(mouse);
  };

  const closeMenu = useCallback(() => setMenuMouse(initialMouse), []);

  // Their data opens on their page, read-only; a change is confirmed first.
  const chooseAction = useCallback(
    (user: AdminUser, action: AdminUserAction) => {
      if (action === 'viewData') {
        navigate(`/${encodeURIComponent(user.username)}`);
      } else {
        setPending({user, action});
      }
    },
    [navigate]
  );

  const confirmChange = async () => {
    if (pending === null) {
      return;
    }
    const {user: target, action} = pending;
    setUpdating(true);
    setUpdateError(null);
    try {
      await applyAction(target, action);
      setPending(null);
      // Reload the page: the change can move the user out of the status
      // filter and changes the counts.
      setQuery(current => ({...current}));
    } catch (error: unknown) {
      if (error instanceof AdminForbiddenError) {
        onForbidden();
        return;
      }
      if (error instanceof UserMismatchError) {
        // Another tab has signed in as someone else: this one leaves.
        setPending(null);
        void leaveForeignSession(error.username);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setUpdateError(t('updateError', {username: target.username, message}));
      setPending(null);
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (value: string | null) =>
    value === null ? t('never') : formatTimestamp(value, i18n.language);

  return (
    <Box id="adminUsers">
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          mb: 2,
        }}
      >
        <TextField
          id="adminUserSearch"
          label={t('searchLabel')}
          type="search"
          size="small"
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          sx={{minWidth: 280}}
        />
        <ToggleButtonGroup
          id="adminStatusFilter"
          aria-label={t('statusLabel')}
          size="small"
          exclusive
          value={query.status}
          onChange={(_event, value: AdminUserStatus | null) => {
            if (value !== null) {
              setQuery(current => ({...current, status: value, page: 1}));
            }
          }}
        >
          <ToggleButton value="all">{t('statusAll')}</ToggleButton>
          <ToggleButton value="active">{t('statusActive')}</ToggleButton>
          <ToggleButton value="inactive">{t('statusInactive')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {updateError !== null && (
        <Alert
          id="adminUpdateError"
          severity="error"
          onClose={() => setUpdateError(null)}
          sx={{mb: 2}}
        >
          {updateError}
        </Alert>
      )}
      {loadFailed && (
        <Alert
          id="adminUsersError"
          severity="error"
          action={
            <Button
              id="adminUsersRetry"
              color="inherit"
              onClick={() => setQuery(current => ({...current}))}
            >
              {t('retry')}
            </Button>
          }
          sx={{mb: 2}}
        >
          {t('loadError')}
        </Alert>
      )}

      <Box sx={{height: 4}}>
        {loading && <LinearProgress aria-label={tCommon('loading')} />}
      </Box>
      <TableContainer>
        <Table size="small" aria-label={t('usersTab')}>
          <TableHead>
            <TableRow>
              {COLUMNS.map(column => (
                <TableCell
                  key={column.label}
                  align={column.numeric ? 'right' : 'left'}
                  sortDirection={
                    column.sort === query.sort
                      ? query.descending
                        ? 'desc'
                        : 'asc'
                      : false
                  }
                >
                  {column.sort === null ? (
                    t(column.label)
                  ) : (
                    <TableSortLabel
                      active={column.sort === query.sort}
                      direction={
                        column.sort === query.sort && query.descending
                          ? 'desc'
                          : 'asc'
                      }
                      onClick={() => {
                        if (column.sort !== null) {
                          sortBy(column.sort);
                        }
                      }}
                    >
                      {t(column.label)}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.items.map(user => {
              const isSelf = user.username === currentUsername;
              return (
                <TableRow
                  key={user.id}
                  id={`adminUserRow${user.id}`}
                  onContextMenu={
                    isSelf
                      ? undefined
                      : event => {
                          event.preventDefault();
                          openMenu(user, {
                            mouseX: event.clientX - 2,
                            mouseY: event.clientY - 4,
                          });
                        }
                  }
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
                    {user.dateMarkedForDeletion === null ? (
                      <Chip
                        size="small"
                        color={user.isActive ? 'success' : 'default'}
                        label={user.isActive ? t('active') : t('inactive')}
                      />
                    ) : (
                      <Chip
                        size="small"
                        color="error"
                        label={t('markedForDeletion')}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={isSelf ? t('cannotChangeSelf') : ''}>
                      <span>
                        <IconButton
                          id={`adminUserMenuButton${user.id}`}
                          size="small"
                          aria-label={t('userActions', {
                            username: user.username,
                          })}
                          aria-haspopup="menu"
                          disabled={isSelf}
                          onClick={event => {
                            const rect =
                              event.currentTarget.getBoundingClientRect();
                            openMenu(user, {
                              mouseX: rect.left,
                              mouseY: rect.bottom,
                            });
                          }}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {users !== null && users.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} id="adminNoUsers">
                  {t('noUsers')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {users !== null && (
        <TablePagination
          component="div"
          count={users.count}
          page={query.page - 1}
          rowsPerPage={query.pageSize}
          rowsPerPageOptions={PAGE_SIZES}
          onPageChange={(_event, next) =>
            setQuery(current => ({...current, page: next + 1}))
          }
          onRowsPerPageChange={event =>
            setQuery(current => ({
              ...current,
              pageSize: Number(event.target.value),
              page: 1,
            }))
          }
          labelRowsPerPage={t('rowsPerPage')}
          labelDisplayedRows={({from, to, count}) =>
            t('displayedRows', {from, to, count})
          }
        />
      )}

      <AdminUserContextMenu
        user={menuUser}
        mouse={menuMouse}
        onClose={closeMenu}
        onAction={chooseAction}
      />

      <Dialog
        open={pending !== null}
        onClose={() => {
          if (!updating) {
            setPending(null);
          }
        }}
        aria-labelledby="adminConfirmTitle"
      >
        {pending !== null && (
          <>
            <DialogTitle id="adminConfirmTitle">
              {t(ACTION_DIALOGS[pending.action].title, {
                username: pending.user.username,
              })}
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                {t(ACTION_DIALOGS[pending.action].body)}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                id="adminConfirmCancel"
                variant="outlined"
                sx={commonButtonSx}
                disabled={updating}
                onClick={() => setPending(null)}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                id="adminConfirmButton"
                variant="outlined"
                color={
                  ACTION_DIALOGS[pending.action].destructive
                    ? 'error'
                    : 'primary'
                }
                sx={commonButtonSx}
                disabled={updating}
                onClick={() => void confirmChange()}
              >
                {t(pending.action)}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

const memoizedAdminUsers = React.memo(AdminUsers);

export {memoizedAdminUsers as AdminUsers};
