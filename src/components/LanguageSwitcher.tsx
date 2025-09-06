import {
  FormControl,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material';
import type React from 'react';
import {useTypedTranslation} from '../i18n/hooks';

export const LanguageSwitcher: React.FC = () => {
  const {i18n} = useTypedTranslation('common');

  const handleLanguageChange = (event: SelectChangeEvent) => {
    i18n.changeLanguage(event.target.value);
  };

  // Generate MenuItem components dynamically from supported languages
  const supportedLanguages = (i18n.options?.supportedLngs as string[])?.filter(
    (lang: string) => lang !== 'cimode'
  ) || ['en', 'es'];

  return (
    <FormControl size="small" sx={{minWidth: 120, ml: 2}}>
      <Select
        value={i18n.language}
        onChange={handleLanguageChange}
        displayEmpty
        sx={{
          color: 'inherit',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.7)',
          },
        }}
      >
        {supportedLanguages.map((langCode: string) => {
          // Get the language name in its own language, with fallback for test environment
          let languageName = langCode.toUpperCase(); // Fallback
          try {
            if (typeof i18n.getFixedT === 'function') {
              languageName = i18n.getFixedT(langCode, 'common')('languageName');
            }
          } catch {
            // Use hardcoded fallbacks for common languages
            const languageNames: Record<string, string> = {
              en: 'English',
              es: 'Español',
            };
            languageName = languageNames[langCode] || langCode.toUpperCase();
          }

          return (
            <MenuItem key={langCode} value={langCode}>
              {languageName}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};
