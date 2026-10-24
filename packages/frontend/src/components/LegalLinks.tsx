import {Box, Link, Typography} from '@mui/material';
import {useTypedTranslation} from '../i18n/hooks';

export function LegalLinks({centered = false}: {centered?: boolean}) {
  const {t} = useTypedTranslation('common');
  return (
    <Box sx={{mt: 2, textAlign: centered ? 'center' : 'left'}}>
      <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
        {t('serviceOperator')}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: centered ? 'center' : 'flex-start',
        }}
      >
        <Link
          href="https://commandsnippets.com/privacy/"
          target="_blank"
          rel="noreferrer"
          variant="body2"
        >
          {t('privacyPolicy')}
        </Link>
        <Link
          href="https://commandsnippets.com/terms/"
          target="_blank"
          rel="noreferrer"
          variant="body2"
        >
          {t('termsOfService')}
        </Link>
      </Box>
    </Box>
  );
}
