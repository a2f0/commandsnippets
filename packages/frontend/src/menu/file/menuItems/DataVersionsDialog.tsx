import type {DataVersion} from '@commandsnippets/api-shared/responses';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {ApiRequestError} from '../../../lib/api/apiClient';
import {
  activateVersion,
  deleteVersion,
  exportBackup,
  listVersions,
} from '../../../lib/data/backup';
import {formatTimestamp} from '../../../lib/formatTimestamp';
import {commonButtonSx} from '../../../theme/sx';

/** What the dialog shows: the list, a confirmation, or work under way. */
type Step =
  | {step: 'list'}
  | {step: 'confirmSwitch'; version: number}
  | {step: 'confirmDelete'; version: number}
  | {step: 'working'}
  /** `detail`: why the API refused, when it said. */
  | {step: 'failed'; detail: string | undefined};

interface IProps {
  open: boolean;
  /** The signed-in user, whose versions they are. */
  username: string;
  onClose: () => void;
}

const counts = {fontFamily: 'monospace', color: 'text.primary'} as const;

/**
 * The signed-in user's data versions (`lib/data/backup.ts`): each one's
 * origin and counts, newest first; any can be exported, and one not active
 * made active (after a warning) or deleted (after another).
 */
const DataVersionsDialog = ({open, username, onClose}: IProps) => {
  const {t, i18n} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');
  const [versions, setVersions] = React.useState<DataVersion[] | null>(null);
  const [step, setStep] = React.useState<Step>({step: 'list'});
  const date = (value: string) => formatTimestamp(value, i18n.language);

  const load = React.useCallback(async () => {
    setVersions(null);
    setVersions(await listVersions(username));
  }, [username]);

  /** Run `work`, then show the list again; a failure says so. */
  const run = React.useCallback(
    (work: () => Promise<void>) => {
      setStep({step: 'working'});
      work()
        .then(async () => {
          await load();
          setStep({step: 'list'});
        })
        .catch((error: unknown) => {
          console.error('ERROR: data version request failed:', error);
          setStep({
            step: 'failed',
            detail: error instanceof ApiRequestError ? error.detail : undefined,
          });
        });
    },
    [load]
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setStep({step: 'list'});
    load().catch((error: unknown) => {
      console.error('ERROR: could not list data versions:', error);
      setStep({step: 'failed', detail: undefined});
    });
  }, [open, load]);

  const button = (
    id: string,
    label: string,
    onClick: () => void,
    color?: 'error'
  ) => (
    <Button
      id={id}
      key={id}
      size="small"
      variant="outlined"
      onClick={onClick}
      sx={commonButtonSx}
      {...(color === undefined ? {} : {color})}
    >
      {label}
    </Button>
  );

  const origin = ({attributes}: DataVersion) =>
    attributes.origin === 'restore'
      ? t('dataVersionRestored', {
          username: attributes.backup_username ?? '',
          exported:
            attributes.backup_exported === null
              ? ''
              : date(attributes.backup_exported),
          date: date(attributes.date_created),
        })
      : t('dataVersionInitial', {date: date(attributes.date_created)});

  const list = (
    <>
      <DialogContentText id="dataVersionsText">
        {t('dataVersionsText')}
      </DialogContentText>
      {versions === null ? (
        <LinearProgress sx={{mt: 2}} aria-label={t('dataVersionsLoading')} />
      ) : (
        <List dense>
          {versions.map(version => {
            const {attributes} = version;
            const n = attributes.version;
            return (
              <ListItem
                key={version.id}
                id={`dataVersion-${n}`}
                divider
                sx={{flexWrap: 'wrap', gap: 1}}
              >
                <ListItemText
                  primary={
                    attributes.active
                      ? `${t('dataVersionName', {version: n})} · ${t('dataVersionActive')}`
                      : t('dataVersionName', {version: n})
                  }
                  secondary={
                    <>
                      {origin(version)}
                      <Box component="span" sx={{display: 'block', ...counts}}>
                        {t('restoreCounts', {
                          tags: attributes.tag_count,
                          entries: attributes.entry_count,
                        })}
                      </Box>
                    </>
                  }
                />
                <Stack direction="row" spacing={1}>
                  {!attributes.active &&
                    button(
                      `dataVersionSwitch-${n}`,
                      t('dataVersionSwitch'),
                      () => setStep({step: 'confirmSwitch', version: n})
                    )}
                  {button(
                    `dataVersionExport-${n}`,
                    t('dataVersionExport'),
                    () =>
                      run(() =>
                        exportBackup(
                          username,
                          attributes.active ? undefined : n
                        )
                      )
                  )}
                  {!attributes.active &&
                    button(
                      `dataVersionDelete-${n}`,
                      t('dataVersionDelete'),
                      () => setStep({step: 'confirmDelete', version: n}),
                      'error'
                    )}
                </Stack>
              </ListItem>
            );
          })}
        </List>
      )}
    </>
  );

  const content = (): {
    title: string;
    body: React.ReactNode;
    actions: React.ReactNode;
  } => {
    const back = button('dataVersionsBack', tCommon('cancel'), () =>
      setStep({step: 'list'})
    );
    switch (step.step) {
      case 'confirmSwitch':
        return {
          title: t('dataVersionSwitchTitle', {version: step.version}),
          body: (
            <DialogContentText id="dataVersionsText">
              {t('dataVersionSwitchText', {version: step.version})}
            </DialogContentText>
          ),
          actions: (
            <>
              {back}
              {button(
                'dataVersionSwitchConfirm',
                t('dataVersionSwitchConfirm'),
                () => run(() => activateVersion(username, step.version))
              )}
            </>
          ),
        };
      case 'confirmDelete':
        return {
          title: t('dataVersionDeleteTitle', {version: step.version}),
          body: (
            <DialogContentText id="dataVersionsText">
              {t('dataVersionDeleteText')}
            </DialogContentText>
          ),
          actions: (
            <>
              {back}
              {button(
                'dataVersionDeleteConfirm',
                t('dataVersionDeleteConfirm'),
                () => run(() => deleteVersion(username, step.version)),
                'error'
              )}
            </>
          ),
        };
      case 'working':
        return {
          title: t('dataVersionsTitle'),
          body: <LinearProgress aria-label={t('dataVersionsLoading')} />,
          actions: null,
        };
      case 'failed':
        return {
          title: t('dataVersionsTitle'),
          body: (
            <>
              <DialogContentText id="dataVersionsText">
                {t('dataVersionsFailed')}
              </DialogContentText>
              {step.detail !== undefined && (
                <DialogContentText id="dataVersionsDetail" sx={{mt: 2}}>
                  {step.detail}
                </DialogContentText>
              )}
            </>
          ),
          actions: button('dataVersionsDismiss', tCommon('dismiss'), () => {
            setStep({step: 'list'});
            load().catch(() => setStep({step: 'failed', detail: undefined}));
          }),
        };
      default:
        return {
          title: t('dataVersionsTitle'),
          body: list,
          actions: button('dataVersionsClose', tCommon('dismiss'), onClose),
        };
    }
  };

  const {title, body, actions} = content();
  return (
    <Dialog
      id="dataVersionsDialog"
      open={open}
      // Nothing closes it while a request runs.
      onClose={step.step === 'working' ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="dataVersionsTitle"
      aria-describedby="dataVersionsText"
    >
      <DialogTitle id="dataVersionsTitle">{title}</DialogTitle>
      <DialogContent>{body}</DialogContent>
      {actions !== null && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
};

const memoizedDataVersionsDialog = React.memo(DataVersionsDialog);

export {memoizedDataVersionsDialog as DataVersionsDialog};
