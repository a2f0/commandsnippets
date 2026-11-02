import type {AnalyticsParams} from '@commandsnippets/api-shared/requests';
import {
  analyticsActivitySchema,
  analyticsIntervalSchema,
} from '@commandsnippets/api-shared/responses';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {useTypedTranslation} from '../../i18n/hooks';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {recentRange, utcDay} from './buckets';

type SetParams = (
  update: (current: AnalyticsParams) => AnalyticsParams
) => void;

/** The recent ranges offered, each with the buckets that suit it. */
const PRESETS = [
  {days: 30, interval: 'day', label: 'last30'},
  {days: 90, interval: 'week', label: 'last90'},
  {days: 365, interval: 'month', label: 'last365'},
] as const;

const Presets = ({
  params,
  setParams,
}: {
  params: AnalyticsParams;
  setParams: SetParams;
}) => {
  const {t} = useTypedTranslation('analytics');
  return (
    <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2}}>
      {PRESETS.map(({days, interval, label}) => (
        <Button
          key={days}
          size="small"
          variant="outlined"
          onClick={() =>
            setParams(current => ({...current, ...recentRange(days), interval}))
          }
        >
          {t(label)}
        </Button>
      ))}
      <Button
        size="small"
        variant={params.from === 'all' ? 'contained' : 'outlined'}
        aria-pressed={params.from === 'all'}
        onClick={() =>
          setParams(current => ({
            ...current,
            from: 'all',
            to: utcDay(new Date()),
            interval: 'month',
          }))
        }
      >
        {t('allTime')}
      </Button>
    </Box>
  );
};

const DateField = ({
  label,
  value,
  helperText,
  onChange,
}: {
  label: string;
  value: string;
  helperText?: string | undefined;
  onChange: (value: string) => void;
}) => (
  <TextField
    size="small"
    type="date"
    label={label}
    sx={{colorScheme: theme => theme.palette.mode}}
    value={value}
    helperText={helperText}
    slotProps={{
      inputLabel: {shrink: true},
      htmlInput: {'aria-label': label},
    }}
    onChange={event => onChange(event.target.value)}
  />
);

/** The tag filter: all tags, or one (an unknown tag in the URL too). */
const TagField = ({
  tag,
  tags,
  setTag,
}: {
  tag: string | undefined;
  tags: readonly ITagJsonApi[];
  setTag: (tag: string) => void;
}) => {
  const {t} = useTypedTranslation('analytics');
  const options = tags.filter(
    option => !option.attributes.is_deleted && /^\d+$/.test(option.id)
  );
  return (
    <TextField
      select
      size="small"
      label={t('tag')}
      slotProps={{
        select: {displayEmpty: true},
        inputLabel: {shrink: true},
      }}
      value={tag ?? ''}
      onChange={event => setTag(event.target.value)}
    >
      <MenuItem value="">{t('allTags')}</MenuItem>
      {tag && !options.some(option => option.id === tag) && (
        <MenuItem value={tag}>{tag}</MenuItem>
      )}
      {options.map(option => (
        <MenuItem key={option.id} value={option.id}>
          {option.attributes.name}
        </MenuItem>
      ))}
    </TextField>
  );
};

interface IProps {
  params: AnalyticsParams;
  setParams: SetParams;
  tags: readonly ITagJsonApi[];
  setTag: (tag: string) => void;
}

/** What the analytics count: the activity, range, buckets and tag. */
export const AnalyticsFilters = ({params, setParams, tags, setTag}: IProps) => {
  const {t} = useTypedTranslation('analytics');
  return (
    <Paper variant="outlined" sx={{p: {xs: 2, sm: 3}, borderRadius: 2}}>
      <Presets params={params} setParams={setParams} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: '1.3fr 1fr 1fr 0.8fr 1fr',
          },
          gap: 2,
        }}
      >
        <TextField
          select
          size="small"
          label={t('activity')}
          value={params.activity}
          onChange={event => {
            const {data} = analyticsActivitySchema.safeParse(
              event.target.value
            );
            if (data !== undefined)
              setParams(current => ({...current, activity: data}));
          }}
        >
          {analyticsActivitySchema.options.map(activity => (
            <MenuItem key={activity} value={activity}>
              {t(activity)}
            </MenuItem>
          ))}
        </TextField>
        <DateField
          label={t('from')}
          value={params.from === 'all' ? '' : params.from}
          helperText={params.from === 'all' ? t('allTime') : undefined}
          onChange={from => setParams(current => ({...current, from}))}
        />
        <DateField
          label={t('to')}
          value={params.to}
          onChange={to => setParams(current => ({...current, to}))}
        />
        <TextField
          select
          size="small"
          label={t('interval')}
          value={params.interval}
          onChange={event => {
            const {data} = analyticsIntervalSchema.safeParse(
              event.target.value
            );
            if (data !== undefined)
              setParams(current => ({...current, interval: data}));
          }}
        >
          {analyticsIntervalSchema.options.map(interval => (
            <MenuItem key={interval} value={interval}>
              {t(interval)}
            </MenuItem>
          ))}
        </TextField>
        <TagField tag={params.tag} tags={tags} setTag={setTag} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
        {t(`${params.activity}Note`)}
      </Typography>
      {params.tag &&
        (params.activity === 'created' || params.activity === 'reused') && (
          <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
            {t('tagCohortNote')}
          </Typography>
        )}
    </Paper>
  );
};
