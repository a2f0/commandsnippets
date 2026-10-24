import type {
  TextEntry,
  TextEntryReused,
} from '@commandsnippets/api-shared/responses';
import {ArrowBack, Check, FileCopySharp} from '@mui/icons-material';
import {Box, Button, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {AppHeader} from '../components/AppHeader';
import {InitialLoadProgress} from '../components/entries/InitialLoadProgress';
import {RobotsNoindex} from '../components/RobotsNoindex';
import {useCookieLogout} from '../hooks/useCookieLogout';
import {useTypedTranslation} from '../i18n/hooks';
import {copyEntry} from '../lib/data/copyEntry';
import {useEntry, useEntryTags, useOwner, useSession} from '../lib/data/hooks';
import {useCollectionSync} from '../lib/data/useSync';
import {formatTimestamp} from '../lib/formatTimestamp';
import {navigate, useRouteParam} from '../lib/router/navigation';
import {Link} from '../lib/router/Router';
import {entryPath} from '../lib/router/route';
import {useAppState} from '../lib/state/appState';
import {isLocalId} from '../lib/sync/outbox';
import type {SyncSession} from '../lib/sync/session';

const buttonSx = {
  color: 'text.primary',
  borderColor: 'text.secondary',
  '&:hover': {borderColor: 'text.primary'},
} as const;

/** How long a copy shows as done. */
const COPIED_MS = 2000;

interface ReuseHistoryProps {
  session: SyncSession;
  entryId: string;
  /** The entry's count: a change (a copy, here or read) reads them again. */
  count: number;
}

type HistoryState =
  | {kind: 'loading'}
  | {kind: 'read'; reuses: TextEntryReused[]}
  | {kind: 'ownerOnly'}
  | {kind: 'failed'};

/**
 * Every reuse of the entry, newest first, read from the API (after the queued
 * writes are sent, so this device's copies are among them): the owner's
 * only. Read again when the entry's count changes; the last list stays
 * meanwhile.
 */
const ReuseHistory = ({session, entryId, count}: ReuseHistoryProps) => {
  const {t, i18n} = useTypedTranslation('entries');
  const [state, setState] = useState<HistoryState>({kind: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const unsent = isLocalId(entryId);

  // Back online, a copy made offline has been sent: read them again.
  useEffect(() => {
    const reread = () => setAttempt(previous => previous + 1);
    window.addEventListener('online', reread);
    return () => window.removeEventListener('online', reread);
  }, []);

  // A new count (a copy), a retry or the connection back reads them again.
  useEffect(() => {
    if (unsent) {
      return undefined;
    }
    let current = true;
    session.sync
      .entryReuses(entryId)
      .then(reuses => {
        if (current) {
          setState(
            reuses === null ? {kind: 'ownerOnly'} : {kind: 'read', reuses}
          );
        }
      })
      .catch((error: unknown) => {
        console.warn('WARNING: the reuses could not be read:', error);
        if (current) {
          setState(previous =>
            previous.kind === 'read' ? previous : {kind: 'failed'}
          );
        }
      });
    return () => {
      current = false;
    };
  }, [session, entryId, count, attempt, unsent]);

  let content: React.ReactNode;
  if (unsent) {
    content = <Typography>{t('infoNotSent')}</Typography>;
  } else if (state.kind === 'loading') {
    content = <Typography role="status">{t('reuseHistoryLoading')}</Typography>;
  } else if (state.kind === 'ownerOnly') {
    content = <Typography>{t('reuseHistoryOwnerOnly')}</Typography>;
  } else if (state.kind === 'failed') {
    content = (
      <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
        <Typography>{t('reuseHistoryFailed')}</Typography>
        <Button
          variant="outlined"
          size="small"
          sx={buttonSx}
          onClick={() => {
            setState({kind: 'loading'});
            setAttempt(previous => previous + 1);
          }}
        >
          {t('reuseHistoryRetry')}
        </Button>
      </Box>
    );
  } else if (state.reuses.length === 0) {
    content = <Typography>{t('reuseHistoryEmpty')}</Typography>;
  } else {
    content = (
      <Box component="ol" id="entryReuses" sx={{m: 0, pl: 3}}>
        {state.reuses.map(reuse => (
          <li key={reuse.id}>
            {formatTimestamp(
              reuse.attributes.date_created,
              i18n.language,
              'medium'
            )}
          </li>
        ))}
      </Box>
    );
  }

  return (
    <Box component="section" aria-labelledby="entryReuseHistory">
      <Typography
        id="entryReuseHistory"
        variant="h6"
        component="h2"
        sx={{mt: 3, mb: 1}}
      >
        {t('reuseHistory')}
      </Typography>
      {content}
    </Box>
  );
};

interface EntryDetailProps {
  entry: TextEntry;
  owner: string;
  session: SyncSession | null;
  /** A public page: no reuse count or history (they are private). */
  publicOnly: boolean;
}

/** The entry: its subject, body, info and (its owner's) reuses. */
const EntryDetail = ({entry, owner, session, publicOnly}: EntryDetailProps) => {
  const {t, i18n} = useTypedTranslation('entries');
  const tags = useEntryTags(entry.id);
  const [copied, setCopied] = useState(false);
  const {id} = entry;
  const {subject, body, is_public, reused_count, date_created, date_updated} =
    entry.attributes;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // Each a link to the tag's list.
  const tagLinks =
    tags === undefined ? null : tags.length === 0 ? (
      t('infoNoTags')
    ) : (
      <Box component="span" sx={{display: 'inline-flex', gap: 1.5}}>
        {tags.map(tag => (
          <Link
            key={tag.id}
            to={`/${encodeURIComponent(owner)}/${encodeURIComponent(tag.attributes.name)}`}
            style={{color: 'inherit'}}
          >
            {tag.attributes.name}
          </Link>
        ))}
      </Box>
    );

  const rows: Array<[key: string, label: string, value: React.ReactNode]> = [
    ['Tags', t('infoTags'), tagLinks],
    [
      'Visibility',
      t('infoVisibility'),
      is_public ? t('infoPublic') : t('infoPrivate'),
    ],
    ...(publicOnly
      ? []
      : [
          [
            'Reused',
            t('infoReused'),
            t('infoTimes', {count: reused_count}),
          ] as [string, string, React.ReactNode],
        ]),
    ['Created', t('infoCreated'), formatTimestamp(date_created, i18n.language)],
    ['Updated', t('infoUpdated'), formatTimestamp(date_updated, i18n.language)],
    [
      'Size',
      t('infoSize'),
      t('infoSizeValue', {
        characters: t('infoCharacters', {count: [...body].length}),
        lines: t('infoLines', {count: body.split('\n').length}),
      }),
    ],
    ['Id', t('infoId'), isLocalId(id) ? t('infoNotSent') : id],
  ];

  return (
    <>
      <Typography variant="overline" sx={{color: 'text.secondary'}}>
        {t('entryInfoTitle')}
      </Typography>
      <Typography
        id="entrySubject"
        variant="h5"
        component="h1"
        sx={{mb: 2, overflowWrap: 'anywhere'}}
      >
        {subject}
      </Typography>
      <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1}}>
        <Box
          component="pre"
          id="entryBody"
          aria-label={t('infoBody')}
          sx={{
            flex: 1,
            m: 0,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            fontFamily: 'monospace',
            fontSize: '13.333px',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {body}
        </Box>
        <Button
          id="entryCopy"
          variant="outlined"
          size="small"
          sx={buttonSx}
          startIcon={copied ? <Check /> : <FileCopySharp />}
          onClick={() => {
            copyEntry(session, id, body);
            setCopied(true);
          }}
        >
          {copied ? t('infoCopied') : t('infoCopy')}
        </Button>
      </Box>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 3,
          rowGap: 1,
          mt: 3,
          mb: 0,
        }}
      >
        {rows.map(([key, label, value]) => (
          <React.Fragment key={key}>
            <Box component="dt" sx={{color: 'text.secondary'}}>
              {label}
            </Box>
            <Box
              component="dd"
              id={`entryInfo${key}`}
              sx={{m: 0, overflowWrap: 'anywhere'}}
            >
              {value}
            </Box>
          </React.Fragment>
        ))}
      </Box>
      {!publicOnly && session !== null && (
        <ReuseHistory session={session} entryId={id} count={reused_count} />
      )}
    </>
  );
};

/**
 * An entry's page (`/:user/entries/:id`, Get Info in its context menu): its
 * subject and body, its info, and every time it was reused. The reuses are
 * private: its owner sees them, staff their count, and a public page
 * neither. Its data syncs as the entries page's does.
 */
const EntryPageContent = () => {
  const {t} = useTypedTranslation('entries');
  useCookieLogout();
  const entryId = useRouteParam('entryId') ?? '';
  const context = useOwner();
  const session = useSession();
  const syncStatus = useCollectionSync();
  // The last entry's, until the one asked for is read: not shown.
  const read = useEntry(entryId);
  const shown = read?.entryId === entryId ? read : undefined;
  const owner = context?.owner ?? '';
  const returnPath = useAppState(
    state => state.entryReturnPaths[entryPath(owner, entryId)]
  );

  let content: React.ReactNode;
  if (shown?.entry) {
    content = (
      // Another entry's page starts afresh: none of the last one's reuses.
      <EntryDetail
        key={shown.entry.id}
        entry={shown.entry}
        owner={owner}
        session={session}
        publicOnly={context?.publicOnly ?? true}
      />
    );
  } else if (shown === undefined || !shown.loaded) {
    content = <Typography role="status">{t('entryLoading')}</Typography>;
  } else {
    content = <Typography>{t('entryNotFound')}</Typography>;
  }

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: '100vh'}}>
      <RobotsNoindex />
      <AppHeader entriesPage={false} />
      <InitialLoadProgress {...syncStatus} />
      <Box
        component="main"
        id="entryPage"
        sx={{flex: 1, px: 3, py: 2, maxWidth: 960, width: '100%'}}
      >
        <Button
          id="entryBack"
          variant="text"
          size="small"
          startIcon={<ArrowBack />}
          sx={{color: 'text.primary', mb: 1}}
          onClick={() =>
            navigate(returnPath ?? `/${encodeURIComponent(owner)}`)
          }
        >
          {t('entryBack')}
        </Button>
        {content}
      </Box>
    </Box>
  );
};

/** Each user's entry page starts afresh, as the entries page does. */
const EntryPage = () => {
  const loggedInUser = useAppState(state => state.loggedInUser);
  const context = useOwner();
  return (
    <EntryPageContent
      key={`${loggedInUser ?? ''}:${context?.owner ?? ''}:${context?.publicOnly ? 'public' : 'full'}`}
    />
  );
};

export {EntryPage};
