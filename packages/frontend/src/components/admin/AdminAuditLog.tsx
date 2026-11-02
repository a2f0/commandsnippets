import {
  Box,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import React from 'react';

import {useTypedTranslation} from '../../i18n/hooks';
import {listAuditLog} from '../../lib/api/adminApi';
import {formatTimestamp} from '../../lib/formatTimestamp';
import {AdminLoadError} from './AdminLoadError';
import {useAdminList} from './useAdminList';

const PAGE_SIZE = 25;

const loadPage = ({page}: {page: number}, signal: AbortSignal) =>
  listAuditLog(page, PAGE_SIZE, signal);

interface IProps {
  onForbidden: () => void;
}

/** What staff changed, newest first. */
const AdminAuditLog = ({onForbidden}: IProps) => {
  const {t, i18n} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  const {request, setRequest, page, loading, loadFailed, reload} = useAdminList(
    {page: 1},
    {load: loadPage, onForbidden, failure: 'Loading the audit log'}
  );
  const entries = page;

  const actionLabel = (action: string) => {
    switch (action) {
      case 'deactivate_user':
        return t('actionDeactivateUser');
      case 'activate_user':
        return t('actionActivateUser');
      case 'mark_user_for_deletion':
        return t('actionMarkUserForDeletion');
      case 'unmark_user_for_deletion':
        return t('actionUnmarkUserForDeletion');
      default:
        return action;
    }
  };

  return (
    <Box id="adminAuditLog">
      {loadFailed && (
        <AdminLoadError id="adminAuditLogError" onRetry={reload} />
      )}
      <Box sx={{height: 4}}>
        {loading && <LinearProgress aria-label={tCommon('loading')} />}
      </Box>
      <TableContainer>
        <Table size="small" aria-label={t('auditLogTab')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('columnWhen')}</TableCell>
              <TableCell>{t('columnAction')}</TableCell>
              <TableCell>{t('columnUser')}</TableCell>
              <TableCell>{t('columnBy')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries?.items.map(entry => (
              <TableRow key={entry.id} id={`adminAuditEntry${entry.id}`}>
                <TableCell>
                  {formatTimestamp(entry.created, i18n.language)}
                </TableCell>
                <TableCell>{actionLabel(entry.action)}</TableCell>
                <TableCell>{entry.targetUsername}</TableCell>
                <TableCell>{entry.actorUsername}</TableCell>
              </TableRow>
            ))}
            {entries !== null && entries.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} id="adminNoAuditEntries">
                  {t('noAuditEntries')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {entries !== null && (
        <TablePagination
          component="div"
          count={entries.count}
          page={request.page - 1}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          onPageChange={(_event, next) => setRequest({page: next + 1})}
          labelDisplayedRows={({from, to, count}) =>
            t('displayedRows', {from, to, count})
          }
        />
      )}
    </Box>
  );
};

const memoizedAdminAuditLog = React.memo(AdminAuditLog);

export {memoizedAdminAuditLog as AdminAuditLog};
