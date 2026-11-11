import type {TextEntry} from '@commandsnippets/api-shared/responses';
import Check from '@mui/icons-material/Check';
import FileCopySharp from '@mui/icons-material/FileCopySharp';
import {Box, Button, Chip, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {DetailPage} from '../components/DetailPage';
import {ReuseHistory} from '../components/entries/ReuseHistory';
import {useCookieLogout} from '../hooks/useCookieLogout';
import {useTypedTranslation} from '../i18n/hooks';
import {copyEntry} from '../lib/data/copyEntry';
import {useEntry, useEntryTags, useOwner, useSession} from '../lib/data/hooks';
import {useCollectionSync} from '../lib/data/useSync';
import {formatTimestamp} from '../lib/formatTimestamp';
import {useRouteParam} from '../lib/router/navigation';
import {Link} from '../lib/router/Router';
import {
  analyticsPath,
  entryPath,
  reusesPath,
  tagPath,
  userPath,
} from '../lib/router/route';
import {useAppState} from '../lib/state/appState';
import {isLocalId} from '../lib/sync/outbox';
import type {SyncSession} from '../lib/sync/session';

/** How long a copy shows as done. */
const COPIED_MS = 2000;

interface EntryDetailProps {
  entry: TextEntry;
  owner: string;
  session: SyncSession | null;
  /** A public page: no reuse count or history (they are private). */
  publicOnly: boolean;
  syncStatus: {failed: boolean; retry: () => void};
}

/** The entry's tags, each a link to the tag's list. */
const TagLinks = ({entryId, owner}: {entryId: string; owner: string}) => {
  const {t} = useTypedTranslation('entries');
  const tags = useEntryTags(entryId);
  if (tags === undefined) return null;
  if (tags.length === 0) return t('infoNoTags');
  return (
    <Box
      component="span"
      sx={{display: 'inline-flex', flexWrap: 'wrap', gap: 1}}
    >
      {tags.map(tag => (
        <Chip
          key={tag.id}
          component={Link}
          to={tagPath(owner, tag.attributes.name)}
          label={tag.attributes.name}
          size="small"
          variant="outlined"
          clickable
        />
      ))}
    </Box>
  );
};

type InfoRow = [key: string, label: string, value: React.ReactNode];

/** The entry's info, a row each: its key (`entryInfo<key>`), label and value. */
function useInfoRows(
  entry: TextEntry,
  owner: string,
  publicOnly: boolean
): InfoRow[] {
  const {t, i18n} = useTypedTranslation('entries');
  const {id} = entry;
  const {body, is_public, reused_count, date_created, date_updated} =
    entry.attributes;
  return [
    ['Tags', t('infoTags'), <TagLinks key="tags" entryId={id} owner={owner} />],
    [
      'Visibility',
      t('infoVisibility'),
      <Chip
        key="visibility"
        size="small"
        variant="outlined"
        label={is_public ? t('infoPublic') : t('infoPrivate')}
      />,
    ],
    ...(publicOnly
      ? []
      : [
          [
            'Reused',
            t('infoReused'),
            t('infoTimes', {count: reused_count}),
          ] satisfies InfoRow,
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
}

const InfoList = ({rows}: {rows: readonly InfoRow[]}) => (
  <Box
    component="dl"
    sx={{
      display: 'grid',
      gridTemplateColumns: 'max-content minmax(0, 1fr)',
      columnGap: 2,
      rowGap: 2,
      m: 0,
      p: 2.5,
      border: 1,
      borderColor: 'divider',
      fontSize: 14,
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
);

/** The entry's body, with Copy (a reuse), which shows it copied a moment. */
const BodyPanel = ({
  entry,
  session,
}: {
  entry: TextEntry;
  session: SyncSession | null;
}) => {
  const {t} = useTypedTranslation('entries');
  const [copied, setCopied] = useState(false);
  const {body} = entry.attributes;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Box sx={{border: 1, borderColor: 'divider', minWidth: 0}}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="subtitle2">{t('infoBody')}</Typography>
        <Button
          id="entryCopy"
          variant="outlined"
          size="small"
          startIcon={copied ? <Check /> : <FileCopySharp />}
          onClick={() => {
            void copyEntry(session, entry.id, body).then(success => {
              if (success) setCopied(true);
            });
          }}
        >
          {copied ? t('infoCopied') : t('infoCopy')}
        </Button>
      </Box>
      <Box
        component="pre"
        id="entryBody"
        aria-label={t('infoBody')}
        sx={{
          m: 0,
          p: 2.5,
          minHeight: 120,
          fontFamily: 'monospace',
          fontSize: 14,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {body}
      </Box>
    </Box>
  );
};

/** The entry: its subject, body, info and (its owner's) reuses. */
const EntryDetail = ({
  entry,
  owner,
  session,
  publicOnly,
  syncStatus,
}: EntryDetailProps) => {
  const {t} = useTypedTranslation('entries');
  const rows = useInfoRows(entry, owner, publicOnly);
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
        {entry.attributes.subject}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {xs: '1fr', md: 'minmax(0, 1fr) 320px'},
          gap: 3,
          alignItems: 'start',
        }}
      >
        <BodyPanel entry={entry} session={session} />
        <InfoList rows={rows} />
      </Box>
      {!publicOnly && session !== null && (
        <ReuseHistory
          session={session}
          entryId={entry.id}
          count={entry.attributes.reused_count}
          initialSync={syncStatus}
        />
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
        syncStatus={syncStatus}
      />
    );
  } else if (shown === undefined || !shown.loaded) {
    content = <Typography role="status">{t('entryLoading')}</Typography>;
  } else {
    content = <Typography>{t('entryNotFound')}</Typography>;
  }

  return (
    <DetailPage
      backId="entryBack"
      id="entryPage"
      backTo={returnPath ?? userPath(owner)}
      backLabel={
        returnPath?.split('?')[0] === analyticsPath(owner)
          ? t('backToAnalytics')
          : returnPath === reusesPath(owner)
            ? t('backToReuses')
            : t('entryBack')
      }
      syncStatus={syncStatus}
    >
      {content}
    </DetailPage>
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
