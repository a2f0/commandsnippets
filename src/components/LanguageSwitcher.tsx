import {Button, ListItemIcon, Menu, MenuItem} from '@mui/material';
import type React from 'react';
import {useCallback, useState} from 'react';
import {useTypedTranslation} from '../i18n/hooks';
import {StyledCheckIcon} from '../styled/StyledCheckIcon';

export const LanguageSwitcher: React.FC = () => {
  const {i18n} = useTypedTranslation('common');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLanguageChange = useCallback(
    (langCode: string) => {
      i18n.changeLanguage(langCode);
      handleClose();
    },
    [i18n, handleClose]
  );

  // Generate MenuItem components dynamically from supported languages
  const supportedLanguages = (i18n.options?.supportedLngs as string[])?.filter(
    (lang: string) => lang !== 'cimode'
  ) || ['en', 'es'];

  // Get current language name
  const getCurrentLanguageName = () => {
    const currentLang = i18n.language || 'en'; // Fallback to 'en' if undefined
    try {
      if (typeof i18n.getFixedT === 'function') {
        return i18n.getFixedT(currentLang, 'common')('languageName');
      }
    } catch {
      // Use hardcoded fallbacks for common languages
      const languageNames: Record<string, string> = {
        en: 'English',
        es: 'Español',
      };
      return languageNames[currentLang] || currentLang.toUpperCase();
    }
    return currentLang.toUpperCase();
  };

  return (
    <>
      <Button
        color="secondary"
        role="combobox"
        size="small"
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleClick}
        aria-label="Select language"
        sx={{
          alignSelf: 'flex-end',
          textTransform: 'none',
          padding: 0,
          minWidth: 0,
          marginRight: 1,
          fontFamily: 'monospace',
          fontSize: 'caption.fontSize',
          lineHeight: 'caption.lineHeight',
          '&:active': {
            backgroundColor: '#585858',
          },
          '&.MuiButton-root': {
            color: theme => theme.palette.text.primary,
            '&:hover': {
              background: 'none',
              textDecoration: 'underline',
            },
          },
        }}
      >
        [{getCurrentLanguageName()}]
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          transition: {
            timeout: 0,
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
            <MenuItem
              key={langCode}
              onClick={() => handleLanguageChange(langCode)}
              sx={theme => ({
                fontSize: 13,
                background: theme.palette.background.default,
                '&:hover': {
                  backgroundColor: theme.selected.background,
                },
              })}
            >
              <ListItemIcon>
                {langCode === (i18n.language || 'en') && <StyledCheckIcon />}
              </ListItemIcon>
              {languageName}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
