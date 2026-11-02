import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import type React from 'react';
import {type AdminKeys, useTypedTranslation} from '../../i18n/hooks';
import type {
  AdminUser,
  AdminUserSortField,
  AdminUsersQuery,
} from '../../lib/api/adminApi';
import type {IMouse} from '../../lib/shared';
import {AdminUserRow} from './AdminUserRow';

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

interface IProps {
  /** The page's users, or null before the first has loaded. */
  users: AdminUser[] | null;
  query: AdminUsersQuery;
  currentUsername: string | null;
  onSort: (field: AdminUserSortField) => void;
  onOpenMenu: (user: AdminUser, at: IMouse) => void;
  onContextMenu: (user: AdminUser, event: React.MouseEvent) => void;
}

const ColumnHeader = ({
  column,
  query,
  onSort,
}: {
  column: Column;
  query: AdminUsersQuery;
  onSort: (field: AdminUserSortField) => void;
}) => {
  const {t} = useTypedTranslation('admin');
  const {sort} = column;
  const direction = sort === query.sort && query.descending ? 'desc' : 'asc';
  return (
    <TableCell
      align={column.numeric ? 'right' : 'left'}
      sortDirection={sort === query.sort ? direction : false}
    >
      {sort === null ? (
        t(column.label)
      ) : (
        <TableSortLabel
          active={sort === query.sort}
          direction={direction}
          onClick={() => onSort(sort)}
        >
          {t(column.label)}
        </TableSortLabel>
      )}
    </TableCell>
  );
};

/** The users of the page, sortable by column. */
export const AdminUsersTable = ({
  users,
  query,
  currentUsername,
  onSort,
  onOpenMenu,
  onContextMenu,
}: IProps) => {
  const {t} = useTypedTranslation('admin');
  return (
    <TableContainer>
      <Table size="small" aria-label={t('usersTab')}>
        <TableHead>
          <TableRow>
            {COLUMNS.map(column => (
              <ColumnHeader
                key={column.label}
                column={column}
                query={query}
                onSort={onSort}
              />
            ))}
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {users?.map(user => (
            <AdminUserRow
              key={user.id}
              user={user}
              isSelf={user.username === currentUsername}
              onOpenMenu={onOpenMenu}
              onContextMenu={onContextMenu}
            />
          ))}
          {users !== null && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1} id="adminNoUsers">
                {t('noUsers')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
