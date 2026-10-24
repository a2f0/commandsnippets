import {Box} from '@mui/material';
import React, {Profiler, useEffect} from 'react';
import {AppHeader} from '../components/AppHeader';
import {BottomToolbar} from '../components/bottomBar/BottomToolbar';
import {LeftDrawer} from '../components/drawer/LeftDrawer';
import {RightDrawer} from '../components/drawer/RightDrawer';
import {EntryList} from '../components/entries/EntryList';
import {InitialLoadProgress} from '../components/entries/InitialLoadProgress';
import {RobotsNoindex} from '../components/RobotsNoindex';
import {useCookieLogout} from '../hooks/useCookieLogout';
import {useOwner} from '../lib/data/hooks';
import {useCollectionSync} from '../lib/data/useSync';
import {recordCommit, useRenderTiming} from '../lib/metrics/hooks';
import {navigate, useRoute} from '../lib/router/navigation';
import {useAppConfig, useAppState} from '../lib/state/appState';

/**
 * The page, which a tag switch does not render again (only the lists showing
 * the tag do): each render is timed for the HUD, the whole page's (its
 * lists' included).
 */
const EntriesPageContent = () => {
  const renderStart = performance.now();
  const atRoot = useRoute(route => route.page === 'root');
  const appConfig = useAppConfig();
  useCookieLogout();
  // The user's data, from the API into IndexedDB, which the lists show.
  const syncStatus = useCollectionSync();

  // Redirect to user's page when on root path.
  useEffect(() => {
    if (atRoot && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  }, [atRoot, appConfig.loggedInUser]);

  useRenderTiming('EntriesPage', renderStart);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {/* A user's page (`/:user/:tag`) stays out of search results; the
          root, the sign-in page for guests, is the app's one to rank. */}
      {atRoot ? null : <RobotsNoindex />}
      {/* Every commit of the page is timed, but the bottom bar's: the HUD
          showing the timings would time itself showing them, ever again. */}
      <Profiler id="EntriesPage" onRender={recordCommit}>
        <AppHeader />
        <InitialLoadProgress {...syncStatus} />
        <Box
          sx={{
            display: 'flex',
            flex: 1,
            paddingBottom: theme => `${theme.footer.height}px`,
          }}
        >
          <LeftDrawer />
          <EntryList />
          <RightDrawer />
        </Box>
      </Profiler>
      <BottomToolbar />
    </Box>
  );
};

const MemoizedEntriesPageContent = React.memo(EntriesPageContent);

/**
 * Each user's page is their own: another signed-in user's (this tab may take
 * up another tab's sign-in), or for staff another user's data, starts
 * afresh, keeping none of the last one's lists, copies or editors while its
 * data loads.
 */
const EntriesPage = () => {
  const loggedInUser = useAppState(state => state.loggedInUser);
  const context = useOwner();
  return (
    <MemoizedEntriesPageContent
      key={`${loggedInUser ?? ''}:${context?.owner ?? ''}:${context?.publicOnly ? 'public' : 'full'}`}
    />
  );
};

export {EntriesPage};
