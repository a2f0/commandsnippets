import {Box, Button, LinearProgress, Typography} from '@mui/material';
import {useLiveQuery} from 'dexie-react-hooks';
import {useTypedTranslation} from '../../i18n/hooks';
import {useSession} from '../../lib/data/hooks';

interface Props {
  failed: boolean;
  retry: () => void;
}

/** The first collection load, kept visible until every entry page is saved. */
export function InitialLoadProgress({failed, retry}: Props) {
  const session = useSession();
  const {t} = useTypedTranslation('entries');
  const cursor = useLiveQuery(async () => {
    if (session === null) {
      return null;
    }
    return (await session.db.cursors.get([session.owner, 'entries'])) ?? null;
  }, [session]);
  const progress = cursor?.initialLoad;
  if (
    cursor === undefined ||
    progress?.complete ||
    (progress === undefined && (cursor !== null || !failed))
  ) {
    return null;
  }
  const total = progress?.totalPages;
  const completed = progress?.pages ?? 0;
  const current =
    total == null ? completed + 1 : Math.min(completed + 1, total);
  const label =
    total == null || total === 0
      ? t('loadingEntries')
      : t('loadingEntryPage', {page: current, pages: total});
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 12,
        bottom: theme => `${theme.footer.height + 12}px`,
        zIndex: theme => theme.zIndex.drawer + 1,
        width: '144px',
        maxWidth: 'calc(100vw - 24px)',
        bgcolor: 'background.paper',
        color: 'text.secondary',
        px: 1,
        py: 0.75,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" role="status" sx={{display: 'block'}}>
        {failed ? t('entryLoadFailed') : label}
      </Typography>
      {failed && total != null && total > 0 && (
        <Typography variant="caption" sx={{display: 'block'}}>
          {t('entryPagesLoaded', {page: completed, pages: total})}
        </Typography>
      )}
      {failed && (
        <Button
          size="small"
          color="inherit"
          onClick={retry}
          sx={{minWidth: 0, p: 0, fontSize: 'caption.fontSize'}}
        >
          {t('retryEntryLoad')}
        </Button>
      )}
      <LinearProgress
        aria-label={label}
        aria-valuetext={
          total == null
            ? undefined
            : t('entryPagesLoaded', {page: completed, pages: total})
        }
        variant={total == null || total === 0 ? 'indeterminate' : 'determinate'}
        value={total == null || total === 0 ? 0 : (completed / total) * 100}
        color="inherit"
        sx={{
          mt: 0.75,
          height: 3,
          bgcolor: 'action.disabledBackground',
          '& .MuiLinearProgress-bar': {bgcolor: 'text.secondary'},
        }}
      />
    </Box>
  );
}
