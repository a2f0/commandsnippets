import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import React, {useEffect, useState} from 'react';

import {useTypedTranslation} from '../../i18n/hooks';
import {
  type AdminAuditEntry,
  AdminForbiddenError,
  type AdminPage,
  listAuditLog,
} from '../../lib/api/adminApi';
import {formatTimestamp} from '../../lib/formatTimestamp';

const PAGE_SIZE = 25;

interface IProps {
  onForbidden: () => void;
}

/** What staff changed, newest first. */
const AdminAuditLog = ({onForbidden}: IProps) => {
  const {t, i18n} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  // A new object (including a copy, to retry) loads that page.
  const [request, setRequest] = useState({page: 1});
  const [entries, setEntries] = useState<AdminPage<AdminAuditEntry> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    listAuditLog(request.page, PAGE_SIZE, controller.signal)
      .then(result => setEntries(result))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof AdminForbiddenError) {
          onForbidden();
          return;
        }
        console.error('Loading the audit log failed:', error);
        setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [request, onForbidden]);

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
        <Alert
          id="adminAuditLogError"
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => setRequest(current => ({...current}))}
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
