import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, {useCallback, useEffect, useState} from 'react';
import {AppHeader} from '../components/AppHeader';
import {AdminAuditLog} from '../components/admin/AdminAuditLog';
import {AdminUsers} from '../components/admin/AdminUsers';
import {useTypedTranslation} from '../i18n/hooks';
import {AdminSignedOutError, getStaffStatus} from '../lib/api/adminApi';
import {resetApplicationState, useAppConfig} from '../lib/state/appState';
import {SignInPage} from './SignInPage';

type Access = 'checking' | 'staff' | 'forbidden' | 'error';
type AdminTab = 'users' | 'auditLog';

/**
 * `/admin`, for staff. Access is checked against the API on every visit (the
 * stored flag can be stale), and the admin API checks it again on each call.
 */
const AdminPage = () => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  // Each user's access is their own: checked again for another user (this
  // tab may take up another tab's sign-in), and until then nothing of the
  // last user's is shown.
  const [checked, setChecked] = useState<{
    user: string | null;
    access: Access;
  }>({user: null, access: 'checking'});
  const [tab, setTab] = useState<AdminTab>('users');
  const {loggedInUser} = appConfig;
  const access = checked.user === loggedInUser ? checked.access : 'checking';

  const checkAccess = useCallback(
    async (isCancelled: () => boolean) => {
      const user = appConfig.loggedInUser;
      setChecked({user, access: 'checking'});
      try {
        const isStaff = await getStaffStatus();
        if (isCancelled()) {
          return;
        }
        appConfig.setIsStaff(isStaff);
        setChecked({user, access: isStaff ? 'staff' : 'forbidden'});
      } catch (error: unknown) {
        if (isCancelled()) {
          return;
        }
        if (error instanceof AdminSignedOutError) {
          // The session expired: sign out locally, which shows sign-in.
          resetApplicationState();
          return;
        }
        console.error('Admin access check failed:', error);
        setChecked({user, access: 'error'});
      }
    },
    [appConfig]
  );

  useEffect(() => {
    if (loggedInUser === null) {
      return;
    }
    let cancelled = false;
    void checkAccess(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loggedInUser, checkAccess]);

  // Stable, so the tabs' data effects don't re-run on every render.
  const forbid = useCallback(() => {
    appConfig.setIsStaff(false);
    setChecked({user: appConfig.loggedInUser, access: 'forbidden'});
  }, [appConfig]);

  if (loggedInUser === null) {
    return <SignInPage />;
  }

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: '100vh'}}>
      <AppHeader entriesPage={false} />
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
                key={loggedInUser}
                currentUsername={loggedInUser}
                onForbidden={forbid}
              />
            ) : (
              <AdminAuditLog key={loggedInUser} onForbidden={forbid} />
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const memoizedAdminPage = React.memo(AdminPage);

export {memoizedAdminPage as AdminPage};
