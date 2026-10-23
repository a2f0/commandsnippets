import {Link} from '@mui/material';
import {useTypedTranslation} from '../i18n/hooks';

export function PrivacyLink() {
  const {t} = useTypedTranslation('common');
  return (
    <Link
      href="https://commandsnippets.com/privacy/"
      target="_blank"
      rel="noreferrer"
      variant="body2"
    >
      {t('privacyPolicy')}
    </Link>
  );
}
