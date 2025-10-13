import {Button, ListItemIcon, Menu, MenuItem} from '@mui/material';
import type React from 'react';
import {useCallback, useState} from 'react';
import {useTypedTranslation} from '../i18n/hooks';
import {StyledCheckIcon} from '../styled/StyledCheckIcon';

export const LanguageSwitcher: React.FC = () => {
  const {t, i18n} = useTypedTranslation('common');
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

  const supportedLanguages = ['en', 'es'];

  // Get language name from translation files using i18n
  const getLanguageName = useCallback(
    (langCode: string) => {
      // 'getFixedT' returns a 't' function for a specific language
      return (
        i18n.getFixedT(langCode, 'common')('languageName') ||
        langCode.toUpperCase()
      );
    },
    [i18n]
  );

  // Get current language name
  const getCurrentLanguageName = useCallback(() => {
    const currentLang = i18n.language || 'en'; // Fallback to 'en' if undefined
    return getLanguageName(currentLang);
  }, [i18n.language, getLanguageName]);

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
        aria-label={t('selectLanguage')}
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
            backgroundColor: theme => theme.palette.action.active,
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
          const languageName = getLanguageName(langCode);

          return (
            <MenuItem
              key={langCode}
              onClick={() => handleLanguageChange(langCode)}
              sx={theme => ({
                fontSize: 'caption.fontSize',
                background: theme.palette.background.default,
                '&:hover': {
                  backgroundColor:
                    theme.selected.background ||
                    theme.palette.action.hover ||
                    'rgba(255, 255, 255, 0.08)',
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
