import {Typography} from '@mui/material';
import {DetailPage} from '../components/DetailPage';
import {ReuseHistory} from '../components/entries/ReuseHistory';
import {useCookieLogout} from '../hooks/useCookieLogout';
import {useTypedTranslation} from '../i18n/hooks';
import {useOwner, useSession} from '../lib/data/hooks';
import {useCollectionSync} from '../lib/data/useSync';
import {Navigate} from '../lib/router/Router';

const ReusesContent = () => {
  useCookieLogout();
  const session = useSession();
  const syncStatus = useCollectionSync();
  const {t} = useTypedTranslation('entries');
  if (session === null) return null;
  return (
    <DetailPage
      backId="reusesBack"
      id="reusesPage"
      backTo={`/${encodeURIComponent(session.owner)}?entries=all`}
      backLabel={t('entryBack')}
      syncStatus={syncStatus}
    >
      <Typography variant="overline" color="text.secondary">
        {session.owner}
      </Typography>
      <Typography variant="h4" component="h1">
        {t('allReuses')}
      </Typography>
      <Typography color="text.secondary" sx={{mt: 1}}>
        {t('allReusesDescription')}
      </Typography>
      <ReuseHistory session={session} initialSync={syncStatus} />
    </DetailPage>
  );
};

/** Reuse history is private even when the profile has public entries. */
export const ReusesPage = () => {
  const owner = useOwner();
  if (owner === null || owner.readOnly)
    return (
      <Navigate
        to={owner ? `/${encodeURIComponent(owner.owner)}` : '/'}
        replace
      />
    );
  return <ReusesContent key={owner.owner} />;
};
