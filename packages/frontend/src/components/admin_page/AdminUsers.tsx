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
import React, {useEffect, useState} from 'react';

import type {AdminKeys} from '../../i18n/hooks';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  AdminForbiddenError,
  type AdminPage,
  type AdminUser,
  type AdminUserSortField,
  type AdminUserStatus,
  type AdminUsersQuery,
  listUsers,
  setUserActive,
} from '../../lib/api/adminApi';
import {formatTimestamp} from '../../lib/formatTimestamp';
import {commonButtonSx} from '../../styles/buttons';

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
  {label: 'columnLogins', sort: 'login_count', numeric: true},
  {label: 'columnEntries', sort: 'entry_count', numeric: true},
  {label: 'columnTags', sort: 'tag_count', numeric: true},
  {label: 'columnStatus', sort: null, numeric: false},
];

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
  const [pending, setPending] = useState<AdminUser | null>(null);
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

  const confirmChange = async () => {
    if (pending === null) {
      return;
    }
    const target = pending;
    setUpdating(true);
    setUpdateError(null);
    try {
      const updated = await setUserActive(target.id, !target.isActive);
      setUsers(current =>
        current === null
          ? current
          : {
              ...current,
              items: current.items.map(user =>
                user.id === updated.id ? updated : user
              ),
            }
      );
      setPending(null);
    } catch (error: unknown) {
      if (error instanceof AdminForbiddenError) {
        onForbidden();
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
                <TableRow key={user.id} id={`adminUserRow${user.id}`}>
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
                  <TableCell align="right">{user.loginCount}</TableCell>
                  <TableCell align="right">{user.entryCount}</TableCell>
                  <TableCell align="right">{user.tagCount}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={user.isActive ? 'success' : 'default'}
                      label={user.isActive ? t('active') : t('inactive')}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={
                        isSelf && user.isActive ? t('cannotDeactivateSelf') : ''
                      }
                    >
                      <span>
                        <Button
                          id={`adminUserToggle${user.id}`}
                          size="small"
                          variant="outlined"
                          color={user.isActive ? 'error' : 'primary'}
                          disabled={isSelf && user.isActive}
                          onClick={() => setPending(user)}
                        >
                          {user.isActive ? t('deactivate') : t('reactivate')}
                        </Button>
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
              {pending.isActive
                ? t('deactivateTitle', {username: pending.username})
                : t('reactivateTitle', {username: pending.username})}
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                {pending.isActive ? t('deactivateBody') : t('reactivateBody')}
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
                color={pending.isActive ? 'error' : 'primary'}
                sx={commonButtonSx}
                disabled={updating}
                onClick={() => void confirmChange()}
              >
                {pending.isActive ? t('deactivate') : t('reactivate')}
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
