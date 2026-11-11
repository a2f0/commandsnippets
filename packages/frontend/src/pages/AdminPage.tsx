import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, {useState} from 'react';
import {AppHeader} from '../components/AppHeader';
import {AdminAuditLog} from '../components/admin/AdminAuditLog';
import {AdminUsers} from '../components/admin/AdminUsers';
import {useStaffAccess} from '../components/admin/useStaffAccess';
import {useTypedTranslation} from '../i18n/hooks';

type AdminTab = 'users' | 'auditLog';

/** The users and the audit log, a tab each. */
const AdminTabs = ({
  tab,
  setTab,
  loggedInUser,
  forbid,
}: {
  tab: AdminTab;
  setTab: (tab: AdminTab) => void;
  loggedInUser: string | null;
  forbid: () => void;
}) => {
  const {t} = useTypedTranslation('admin');
  return (
    <>
      <Tabs
        value={tab}
        onChange={(_event, value: AdminTab) => setTab(value)}
        sx={{mb: 2}}
      >
        <Tab id="adminUsersTab" value="users" label={t('usersTab')} />
        <Tab id="adminAuditLogTab" value="auditLog" label={t('auditLogTab')} />
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
  );
};

/** `/admin`, for staff. */
const AdminPage = () => {
  const {t} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  const {access, loggedInUser, retry, forbid} = useStaffAccess();
  const [tab, setTab] = useState<AdminTab>('users');

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
              <Button id="adminPageRetry" color="inherit" onClick={retry}>
                {t('retry')}
              </Button>
            }
          >
            {t('loadError')}
          </Alert>
        )}
        {access === 'staff' && (
          <AdminTabs
            tab={tab}
            setTab={setTab}
            loggedInUser={loggedInUser}
            forbid={forbid}
          />
        )}
      </Box>
    </Box>
  );
};

const memoizedAdminPage = React.memo(AdminPage);

export {memoizedAdminPage as AdminPage};
