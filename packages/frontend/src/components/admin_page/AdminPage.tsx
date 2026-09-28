import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useState} from 'react';

import {useAppContext} from '../../AppContext';
import {useTypedTranslation} from '../../i18n/hooks';
import {tearleadsApi} from '../../lib/api/tearleadsApi';
import {AppHeader} from '../AppHeader';
import {SignInPage} from '../sign_in_page/SignInPage';
import {AdminAuditLog} from './AdminAuditLog';
import {AdminUsers} from './AdminUsers';

type Access = 'checking' | 'staff' | 'forbidden' | 'error';
type AdminTab = 'users' | 'auditLog';

/**
 * `/admin`, for staff. Access is checked against the API on every visit (the
 * stored flag can be stale), and the admin API checks it again on each call.
 */
const AdminPage = () => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  const [access, setAccess] = useState<Access>('checking');
  const [tab, setTab] = useState<AdminTab>('users');
  const loggedIn = appConfig.loggedInUser !== null;

  const checkAccess = useCallback(
    async (isCancelled: () => boolean) => {
      setAccess('checking');
      try {
        const user = await tearleadsApi.getCurrentUser();
        if (isCancelled()) {
          return;
        }
        const isStaff = user.data.attributes.is_staff === true;
        appConfig.setIsStaff(isStaff);
        setAccess(isStaff ? 'staff' : 'forbidden');
      } catch (error: unknown) {
        if (!isCancelled()) {
          console.error('Admin access check failed:', error);
          setAccess('error');
        }
      }
    },
    [appConfig]
  );

  useEffect(() => {
    if (!loggedIn) {
      return;
    }
    let cancelled = false;
    void checkAccess(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loggedIn, checkAccess]);

  // Stable, so the tabs' data effects don't re-run on every render.
  const forbid = useCallback(() => {
    appConfig.setIsStaff(false);
    setAccess('forbidden');
  }, [appConfig]);

  if (!loggedIn) {
    return <SignInPage />;
  }

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: '100vh'}}>
      <AppHeader />
      <Box component="main" id="adminPage" sx={{flex: 1, p: 3}}>
        <Typography variant="h1" sx={{fontSize: '1.75rem', mb: 2}}>
          {t('title')}
        </Typography>
        {access === 'checking' && (
          <CircularProgress
            id="adminPageLoading"
            aria-label={tCommon('loading')}
          />
        )}
        {access === 'forbidden' && (
          <Alert id="adminPageForbidden" severity="warning">
            {t('forbidden')}
          </Alert>
        )}
        {access === 'error' && (
          <Alert
            id="adminPageError"
            severity="error"
            action={
              <Button
                id="adminPageRetry"
                color="inherit"
                onClick={() => void checkAccess(() => false)}
              >
                {t('retry')}
              </Button>
            }
          >
            {t('loadError')}
          </Alert>
        )}
        {access === 'staff' && (
          <>
            <Tabs
              value={tab}
              onChange={(_event, value: AdminTab) => setTab(value)}
              sx={{mb: 2}}
            >
              <Tab id="adminUsersTab" value="users" label={t('usersTab')} />
              <Tab
                id="adminAuditLogTab"
                value="auditLog"
                label={t('auditLogTab')}
              />
            </Tabs>
            {tab === 'users' ? (
              <AdminUsers
                currentUsername={appConfig.loggedInUser}
                onForbidden={forbid}
              />
            ) : (
              <AdminAuditLog onForbidden={forbid} />
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const memoizedAdminPage = React.memo(observer(AdminPage));

export {memoizedAdminPage as AdminPage};
