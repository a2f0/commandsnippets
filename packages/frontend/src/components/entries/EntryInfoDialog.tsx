import type {TextEntry} from '@commandsnippets/api-shared/responses';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import React, {useEffect} from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {useEntryTags, useSession} from '../../lib/data/hooks';
import {formatTimestamp} from '../../lib/formatTimestamp';
import {isLocalId} from '../../lib/sync/outbox';

interface IProps {
  /** The entry as the list holds it: the dialog follows its changes. */
  entry: TextEntry;
  onClose: () => void;
}

/**
 * An entry's info (the context menu's Get Info): its subject, tags,
 * visibility, reuse count, dates, size and id. Owners and staff only: the
 * reuse count is private, and public pages do not offer it. Opening it reads
 * the entry again (`refreshEntry`), for the reuse count other devices' copies
 * changed, which the sync does not see.
 */
const EntryInfoDialog = ({entry, onClose}: IProps) => {
  const {t, i18n} = useTypedTranslation('entries');
  const session = useSession();
  const tags = useEntryTags(entry.id);
  const {id} = entry;
  const {subject, body, is_public, reused_count, date_created, date_updated} =
    entry.attributes;

  useEffect(() => {
    if (session === null || isLocalId(id)) {
      return;
    }
    session.sync
      .refreshEntry(id)
      .catch((error: unknown) =>
        console.warn('WARNING: the entry could not be read again:', error)
      );
  }, [session, id]);

  const rows: Array<[key: string, label: string, value: string]> = [
    ['Subject', t('infoSubject'), subject],
    [
      'Tags',
      t('infoTags'),
      tags === undefined
        ? ''
        : tags.length === 0
          ? t('infoNoTags')
          : tags.map(tag => tag.attributes.name).join(', '),
    ],
    [
      'Visibility',
      t('infoVisibility'),
      is_public ? t('infoPublic') : t('infoPrivate'),
    ],
    ['Reused', t('infoReused'), t('infoTimes', {count: reused_count})],
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

  // Rendered by the row: its events reach the list's handlers through the
  // portal, which would deselect the entry or open the list's menu.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <Dialog
      id={`entryInfoDialog-${id}`}
      open={true}
      onClose={onClose}
      onClick={stop}
      onMouseDown={stop}
      onContextMenu={stop}
      fullWidth={true}
      maxWidth="sm"
      aria-labelledby={`entryInfoTitle-${id}`}
    >
      <DialogTitle id={`entryInfoTitle-${id}`}>
        {t('entryInfoTitle')}
      </DialogTitle>
      <DialogContent>
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            columnGap: 3,
            rowGap: 1,
            m: 0,
          }}
        >
          {rows.map(([key, label, value]) => (
            <React.Fragment key={key}>
              <Box
                component="dt"
                sx={{color: theme => theme.palette.text.secondary}}
              >
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
      </DialogContent>
      <DialogActions>
        <Button
          id={`entryInfoClose-${id}`}
          color="secondary"
          variant="outlined"
          onClick={onClose}
          autoFocus
          sx={{
            color: theme => theme.palette.text.primary,
            borderColor: theme => theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme => theme.palette.text.primary,
            },
          }}
        >
          {t('infoClose')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export {EntryInfoDialog};
