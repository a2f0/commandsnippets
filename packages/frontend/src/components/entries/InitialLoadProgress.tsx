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
        position: 'sticky',
        top: theme => `${theme.appBar.height}px`,
        zIndex: theme => theme.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        mx: theme => `${theme.drawer.width}px`,
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
        <Typography variant="body2" role="status" sx={{flex: 1}}>
          {failed ? t('entryLoadFailed') : label}
        </Typography>
        {failed && (
          <Button size="small" onClick={retry}>
            {t('retryEntryLoad')}
          </Button>
        )}
      </Box>
      {failed && total != null && total > 0 && (
        <Typography variant="caption">
          {t('entryPagesLoaded', {page: completed, pages: total})}
        </Typography>
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
        color={failed ? 'error' : 'primary'}
        sx={{mt: 1}}
      />
    </Box>
  );
}
