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
import {ApiRequestError} from '../../../lib/api/errors';
import {
  activateVersion,
  deleteVersion,
  exportBackup,
  listVersions,
} from '../../../lib/data/backup';
import {formatTimestamp} from '../../../lib/formatTimestamp';

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

const button = (id: string, label: string, onClick: () => void) => (
  <Button id={id} key={id} size="small" variant="outlined" onClick={onClick}>
    {label}
  </Button>
);

/**
 * The versions (read again each time the dialog opens), and the step the
 * dialog is at. `run` does a request, then lists the versions again; a
 * failure says so.
 */
function useDataVersions(open: boolean, username: string) {
  const [versions, setVersions] = React.useState<DataVersion[] | null>(null);
  const [step, setStep] = React.useState<Step>({step: 'list'});

  const load = React.useCallback(async () => {
    setVersions(null);
    setVersions(await listVersions(username));
  }, [username]);

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

  return {versions, step, setStep, load, run};
}

/** A version: its name, origin and counts, and what can be done with it. */
const VersionItem = ({
  version,
  username,
  run,
  setStep,
}: {
  version: DataVersion;
  username: string;
  run: (work: () => Promise<void>) => void;
  setStep: (step: Step) => void;
}) => {
  const {t, i18n} = useTypedTranslation('menu');
  const date = (value: string) => formatTimestamp(value, i18n.language);
  const {attributes} = version;
  const n = attributes.version;
  const name = t('dataVersionName', {version: n});
  const origin =
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
  return (
    <ListItem id={`dataVersion-${n}`} divider sx={{flexWrap: 'wrap', gap: 1}}>
      <ListItemText
        primary={
          attributes.active ? `${name} · ${t('dataVersionActive')}` : name
        }
        secondary={
          <>
            {origin}
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
          button(`dataVersionSwitch-${n}`, t('dataVersionSwitch'), () =>
            setStep({step: 'confirmSwitch', version: n})
          )}
        {button(`dataVersionExport-${n}`, t('dataVersionExport'), () =>
          run(() => exportBackup(username, attributes.active ? undefined : n))
        )}
        {!attributes.active &&
          button(`dataVersionDelete-${n}`, t('dataVersionDelete'), () =>
            setStep({step: 'confirmDelete', version: n})
          )}
      </Stack>
    </ListItem>
  );
};

const VersionList = ({
  versions,
  ...item
}: {
  versions: DataVersion[] | null;
  username: string;
  run: (work: () => Promise<void>) => void;
  setStep: (step: Step) => void;
}) => {
  const {t} = useTypedTranslation('menu');
  return (
    <>
      <DialogContentText id="dataVersionsText">
        {t('dataVersionsText')}
      </DialogContentText>
      {versions === null ? (
        <LinearProgress sx={{mt: 2}} aria-label={t('dataVersionsLoading')} />
      ) : (
        <List dense>
          {versions.map(version => (
            <VersionItem key={version.id} version={version} {...item} />
          ))}
        </List>
      )}
    </>
  );
};

/** The dialog's title, text and buttons at the step it is at. */
function useStepContent(
  {versions, step, setStep, load, run}: ReturnType<typeof useDataVersions>,
  username: string,
  onClose: () => void
): {title: string; body: React.ReactNode; actions: React.ReactNode} {
  const {t} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');
  const back = button('dataVersionsBack', tCommon('cancel'), () =>
    setStep({step: 'list'})
  );
  const text = (content: React.ReactNode) => (
    <DialogContentText id="dataVersionsText">{content}</DialogContentText>
  );
  switch (step.step) {
    case 'confirmSwitch':
      return {
        title: t('dataVersionSwitchTitle', {version: step.version}),
        body: text(t('dataVersionSwitchText', {version: step.version})),
        actions: [
          back,
          button(
            'dataVersionSwitchConfirm',
            t('dataVersionSwitchConfirm'),
            () => run(() => activateVersion(username, step.version))
          ),
        ],
      };
    case 'confirmDelete':
      return {
        title: t('dataVersionDeleteTitle', {version: step.version}),
        body: text(t('dataVersionDeleteText')),
        actions: [
          back,
          button(
            'dataVersionDeleteConfirm',
            t('dataVersionDeleteConfirm'),
            () => run(() => deleteVersion(username, step.version))
          ),
        ],
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
            {text(t('dataVersionsFailed'))}
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
        body: (
          <VersionList
            versions={versions}
            username={username}
            run={run}
            setStep={setStep}
          />
        ),
        actions: button('dataVersionsClose', tCommon('dismiss'), onClose),
      };
  }
}

/**
 * The signed-in user's data versions (`lib/data/backup.ts`): each one's
 * origin and counts, newest first; any can be exported, and one not active
 * made active (after a warning) or deleted (after another).
 */
const DataVersionsDialog = ({open, username, onClose}: IProps) => {
  const data = useDataVersions(open, username);
  const {title, body, actions} = useStepContent(data, username, onClose);
  return (
    <Dialog
      id="dataVersionsDialog"
      open={open}
      // Nothing closes it while a request runs.
      onClose={data.step.step === 'working' ? undefined : onClose}
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
