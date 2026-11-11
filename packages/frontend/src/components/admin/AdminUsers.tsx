import {Alert, Box, LinearProgress, TablePagination} from '@mui/material';
import React, {useCallback, useEffect, useState} from 'react';

import {useContextMenu} from '../../hooks/useContextMenu';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  AdminApiError,
  AdminForbiddenError,
  type AdminUser,
  type AdminUserSortField,
  type AdminUsersQuery,
  listUsers,
  setUserActive,
  setUserMarkedForDeletion,
} from '../../lib/api/adminApi';
import {UserMismatchError} from '../../lib/api/errors';
import {navigate} from '../../lib/router/navigation';
import {userPath} from '../../lib/router/route';
import type {IMouse} from '../../lib/shared';
import {leaveForeignSession} from '../../lib/state/appState';
import {AdminConfirmDialog, type PendingChange} from './AdminConfirmDialog';
import {AdminLoadError} from './AdminLoadError';
import {
  type AdminUserAction,
  type AdminUserChange,
  AdminUserContextMenu,
} from './AdminUserContextMenu';
import {AdminUsersTable} from './AdminUsersTable';
import {AdminUsersToolbar} from './AdminUsersToolbar';
import {useAdminList} from './useAdminList';

const PAGE_SIZES = [25, 50, 100];
const SEARCH_DELAY_MS = 300;

const INITIAL_QUERY: AdminUsersQuery = {
  search: '',
  status: 'all',
  sort: 'date_joined',
  descending: true,
  page: 1,
  pageSize: PAGE_SIZES[0] ?? 25,
};

/** The page before, when a change emptied the last one. */
const pageGone = (error: unknown, query: AdminUsersQuery) =>
  error instanceof AdminApiError && error.status === 404 && query.page > 1
    ? {...query, page: query.page - 1}
    : null;

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

/** A new column starts with the most useful end first. */
const sortedBy = (
  query: AdminUsersQuery,
  field: AdminUserSortField
): AdminUsersQuery => ({
  ...query,
  sort: field,
  descending:
    field === query.sort
      ? !query.descending
      : field !== 'username' && field !== 'email',
  page: 1,
});

/** Makes a confirmed change; the list reloads when it is made. */
function useUserChange(onForbidden: () => void, onChanged: () => void) {
  const {t} = useTypedTranslation('admin');
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

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
      // The change can move the user out of the status filter and changes
      // the counts.
      onChanged();
    } catch (error: unknown) {
      if (error instanceof AdminForbiddenError) {
        onForbidden();
        return;
      }
      setPending(null);
      if (error instanceof UserMismatchError) {
        // Another tab has signed in as someone else: this one leaves.
        void leaveForeignSession(error.username);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setUpdateError(t('updateError', {username: target.username, message}));
    } finally {
      setUpdating(false);
    }
  };

  return {
    pending,
    setPending,
    updating,
    updateError,
    setUpdateError,
    confirmChange,
  };
}

/** The search field's text, searched once the admin pauses typing. */
function useDebouncedSearch(onSearch: (search: string) => void) {
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => onSearch(searchInput), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, onSearch]);
  return [searchInput, setSearchInput] as const;
}

/**
 * A user's actions menu, from their row's button or a right click. It keeps
 * its user while it closes; the position opens and closes it. Their data
 * opens on their page, read-only; a change is confirmed first.
 */
function useUserMenu(confirm: (change: PendingChange) => void) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const {mouse, close, openAt, onContextMenu} = useContextMenu();
  const onAction = useCallback(
    (target: AdminUser, action: AdminUserAction) => {
      if (action === 'viewData') {
        navigate(userPath(target.username));
      } else {
        confirm({user: target, action});
      }
    },
    [confirm]
  );
  return {
    openAt: useCallback(
      (target: AdminUser, at: IMouse) => {
        setUser(target);
        openAt(at);
      },
      [openAt]
    ),
    onContextMenu: useCallback(
      (target: AdminUser, event: React.MouseEvent) => {
        setUser(target);
        onContextMenu(event);
      },
      [onContextMenu]
    ),
    menuProps: {user, mouse, onClose: close, onAction},
  };
}

const AdminUsersPagination = ({
  count,
  query,
  setQuery,
}: {
  count: number;
  query: AdminUsersQuery;
  setQuery: React.Dispatch<React.SetStateAction<AdminUsersQuery>>;
}) => {
  const {t} = useTypedTranslation('admin');
  return (
    <TablePagination
      component="div"
      count={count}
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
      labelDisplayedRows={({from, to, count: total}) =>
        t('displayedRows', {from, to, count: total})
      }
    />
  );
};

interface IProps {
  currentUsername: string | null;
  /** The API said the viewer is not staff (revoked since the page loaded). */
  onForbidden: () => void;
}

const AdminUsers = ({currentUsername, onForbidden}: IProps) => {
  const {t: tCommon} = useTypedTranslation('common');
  const list = useAdminList(INITIAL_QUERY, {
    load: listUsers,
    onForbidden,
    failure: 'Loading users',
    fallback: pageGone,
  });
  const {request: query, setRequest: setQuery, page: users} = list;
  const search = useCallback(
    (text: string) =>
      setQuery(current =>
        current.search === text ? current : {...current, search: text, page: 1}
      ),
    [setQuery]
  );
  const [searchInput, setSearchInput] = useDebouncedSearch(search);
  const change = useUserChange(onForbidden, list.reload);
  const userMenu = useUserMenu(change.setPending);

  return (
    <Box id="adminUsers">
      <AdminUsersToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={query.status}
        onStatusChange={status =>
          setQuery(current => ({...current, status, page: 1}))
        }
      />
      {change.updateError !== null && (
        <Alert
          id="adminUpdateError"
          severity="error"
          onClose={() => change.setUpdateError(null)}
          sx={{mb: 2}}
        >
          {change.updateError}
        </Alert>
      )}
      {list.loadFailed && (
        <AdminLoadError
          id="adminUsersError"
          retryId="adminUsersRetry"
          onRetry={list.reload}
        />
      )}
      <Box sx={{height: 4}}>
        {list.loading && <LinearProgress aria-label={tCommon('loading')} />}
      </Box>
      <AdminUsersTable
        users={users?.items ?? null}
        query={query}
        currentUsername={currentUsername}
        onSort={field => setQuery(current => sortedBy(current, field))}
        onOpenMenu={userMenu.openAt}
        onContextMenu={userMenu.onContextMenu}
      />
      {users !== null && (
        <AdminUsersPagination
          count={users.count}
          query={query}
          setQuery={setQuery}
        />
      )}
      <AdminUserContextMenu {...userMenu.menuProps} />
      <AdminConfirmDialog
        pending={change.pending}
        updating={change.updating}
        onCancel={() => change.setPending(null)}
        onConfirm={() => void change.confirmChange()}
      />
    </Box>
  );
};

const memoizedAdminUsers = React.memo(AdminUsers);

export {memoizedAdminUsers as AdminUsers};
