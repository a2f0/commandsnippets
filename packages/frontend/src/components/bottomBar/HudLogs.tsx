import {Box} from '@mui/material';
import {useMemo} from 'react';
import {type LogEntry, useErrorStore} from '../../hooks/useErrorStore';
import {useTypedTranslation} from '../../i18n/hooks';

/** How many logs the expanded Logs tab lists, newest first. */
const RECENT_LOGS = 20;

const LOG_LEVEL_COLOR: Record<LogEntry['level'], string> = {
  ERROR: 'error.main',
  WARN: 'warning.main',
  DEBUG: 'text.disabled',
  INFO: 'text.primary',
};

const logListSx = {
  mt: 2,
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  overflow: 'auto',
  backgroundColor: 'background.default',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  p: 1,
};

const detailsSummarySx = {cursor: 'pointer', fontSize: '0.75rem', opacity: 0.8};

const detailsSx = {
  fontSize: '0.75rem',
  margin: '5px 0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const HudLog = ({log}: {log: LogEntry}) => {
  const {t} = useTypedTranslation('menu');
  return (
    <Box sx={{mb: 0.5, color: LOG_LEVEL_COLOR[log.level]}}>
      <span>
        [{log.timestamp.toLocaleTimeString()}] {log.level}: {log.message}
      </span>
      {log.details && (
        <Box component="details" sx={{marginLeft: 2.5}}>
          <Box component="summary" sx={detailsSummarySx}>
            {t('details')}
          </Box>
          <Box component="pre" sx={detailsSx}>
            {log.details}
          </Box>
        </Box>
      )}
    </Box>
  );
};

/** The HUD's Logs tab: a count collapsed, the latest logs expanded. */
export const HudLogs = ({isExpanded}: {isExpanded: boolean}) => {
  const {t} = useTypedTranslation('menu');
  const logs = useErrorStore(state => state.logs);
  const errorCount = useErrorStore(state => state.errors.length);
  const recentLogs = useMemo(
    () =>
      [...logs]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, RECENT_LOGS),
    [logs]
  );

  if (!isExpanded) {
    return (
      <Box sx={{mt: 1, fontSize: '0.875rem', color: 'text.disabled'}}>
        {logs.length === 0
          ? t('noLogsAvailable')
          : t('logEntry', {count: logs.length})}
        {errorCount > 0 && ` • ${t('errorCaptured', {count: errorCount})}`}
      </Box>
    );
  }
  return (
    <Box sx={logListSx}>
      {recentLogs.map(log => (
        <HudLog key={log.id} log={log} />
      ))}
      {logs.length === 0 && (
        <Box sx={{color: 'text.disabled', fontStyle: 'italic'}}>
          {t('noLogsAvailable')}
        </Box>
      )}
    </Box>
  );
};
