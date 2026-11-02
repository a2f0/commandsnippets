import {Button, ListItemIcon, Menu, MenuItem} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import type React from 'react';
import {useCallback, useState} from 'react';
import {useTypedTranslation} from '../i18n/hooks';
import {supportedLanguages} from '../i18n/i18n';
import {StyledCheckIcon} from '../styled/StyledCheckIcon';

const buttonSx = {
  alignSelf: 'flex-end',
  textTransform: 'none',
  padding: 0,
  minWidth: 0,
  marginRight: 1,
  fontFamily: 'monospace',
  fontSize: 'caption.fontSize',
  lineHeight: 'caption.lineHeight',
  '&:active': {
    backgroundColor: (theme: Theme) => theme.palette.action.active,
  },
  '&.MuiButton-root': {
    color: (theme: Theme) => theme.palette.text.primary,
    '&:hover': {
      background: 'none',
      textDecoration: 'underline',
    },
  },
};

const itemSx = (theme: Theme) => ({
  fontSize: 'caption.fontSize',
  background: theme.palette.background.default,
  '&:hover': {
    backgroundColor: theme.selected.background,
  },
});

export const LanguageSwitcher: React.FC = () => {
  const {t, i18n} = useTypedTranslation('common');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const current = i18n.language || 'en';

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  /** The language's own name for itself, from its translations. */
  const nameOf = (language: string) =>
    i18n.getFixedT(language, 'common')('languageName') ||
    language.toUpperCase();

  return (
    <>
      <Button
        color="secondary"
        role="combobox"
        size="small"
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={event => setAnchorEl(event.currentTarget)}
        aria-label={t('selectLanguage')}
        sx={buttonSx}
      >
        [{nameOf(current)}]
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{vertical: 'top', horizontal: 'left'}}
        transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
        slotProps={{transition: {timeout: 0}}}
      >
        {supportedLanguages.map(language => (
          <MenuItem
            key={language}
            onClick={() => {
              i18n.changeLanguage(language);
              handleClose();
            }}
            sx={itemSx}
          >
            <ListItemIcon>
              {language === current && <StyledCheckIcon />}
            </ListItemIcon>
            {nameOf(language)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
