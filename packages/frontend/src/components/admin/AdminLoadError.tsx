import {Alert, Button} from '@mui/material';
import {useTypedTranslation} from '../../i18n/hooks';

interface IProps {
  id: string;
  /** The Retry button's id. */
  retryId?: string;
  onRetry: () => void;
}

/** An admin list that failed to load, with Retry. */
export const AdminLoadError = ({id, retryId, onRetry}: IProps) => {
  const {t} = useTypedTranslation('admin');
  return (
    <Alert
      id={id}
      severity="error"
      action={
        <Button id={retryId} color="inherit" onClick={onRetry}>
          {t('retry')}
        </Button>
      }
      sx={{mb: 2}}
    >
      {t('loadError')}
    </Alert>
  );
};
