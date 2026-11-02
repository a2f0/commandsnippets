import type {
  TextEntry,
  TextEntryReused,
} from '@commandsnippets/api-shared/responses';
import History from '@mui/icons-material/History';
import {Box, Typography} from '@mui/material';
import {useTypedTranslation} from '../../i18n/hooks';
import {formatTimestamp, timestampWithZone} from '../../lib/formatTimestamp';
import {Link} from '../../lib/router/Router';
import {entryPath, reusesPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';

interface ReuseRowProps {
  reuse: TextEntryReused;
  owner: string;
  /** The reused entry, if it was read (and is not deleted). */
  entry: TextEntry | undefined;
  /** The profile's history: each row names its entry. */
  all: boolean;
}

/** The reused entry, linked to its page (which returns to the history). */
const ReusedEntry = ({reuse, owner, entry}: Omit<ReuseRowProps, 'all'>) => {
  const {t} = useTypedTranslation('entries');
  const id = reuse.relationships.text_entry.data.id;
  const path = entryPath(owner, id);
  return (
    <Typography sx={{fontWeight: 500, mb: 0.5, overflowWrap: 'anywhere'}}>
      {entry ? (
        <Link
          to={path}
          style={{color: 'inherit', textUnderlineOffset: '3px'}}
          onClick={() =>
            useAppState.getState().setEntryReturnPath(path, reusesPath(owner))
          }
        >
          {entry.attributes.subject}
        </Link>
      ) : (
        t('reuseUnavailableEntry', {id})
      )}
    </Typography>
  );
};

const ReuseRow = ({reuse, owner, entry, all}: ReuseRowProps) => {
  const {i18n} = useTypedTranslation('entries');
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        px: {xs: 2, sm: 3},
        py: 2,
        '& + li': {borderTop: 1, borderColor: 'divider'},
      }}
    >
      <History sx={{fontSize: 20, color: 'text.secondary', mt: 0.25}} />
      <Box sx={{minWidth: 0}}>
        {all && <ReusedEntry reuse={reuse} owner={owner} entry={entry} />}
        <Typography
          component="time"
          variant="body2"
          dateTime={timestampWithZone(reuse.attributes.date_created)}
          color={all ? 'text.secondary' : 'text.primary'}
        >
          {formatTimestamp(
            reuse.attributes.date_created,
            i18n.language,
            'medium'
          )}
        </Typography>
      </Box>
    </Box>
  );
};

interface IProps {
  reuses: readonly TextEntryReused[];
  entries: readonly TextEntry[];
  owner: string;
  all: boolean;
  loading: boolean;
}

/** The reuses read so far, newest first. */
export const ReuseHistoryList = ({
  reuses,
  entries,
  owner,
  all,
  loading,
}: IProps) => {
  const {t} = useTypedTranslation('entries');
  const entryById = new Map(entries.map(entry => [entry.id, entry]));
  return (
    <Box
      component="ol"
      id="entryReuses"
      aria-label={t('reuseHistory')}
      aria-busy={loading}
      sx={{listStyle: 'none', p: 0, m: 0}}
    >
      {reuses.map(reuse => (
        <ReuseRow
          key={reuse.id}
          reuse={reuse}
          owner={owner}
          entry={entryById.get(reuse.relationships.text_entry.data.id)}
          all={all}
        />
      ))}
    </Box>
  );
};
