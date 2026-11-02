import {Box} from '@mui/material';
import React from 'react';
import {useFeatureFlag} from '../../lib/featureFlags/featureFlags';
import {TextEntrySearchField} from '../entries/TextEntrySearchField';
import {LanguageSwitcher} from '../LanguageSwitcher';
import {TagSearch} from '../tags/TagSearch';
import {HudMenu} from './HudMenu';
import {Mode} from './Mode';

const BottomBar = () => {
  const showHud = useFeatureFlag('hud');
  const showLanguageSwitcher = useFeatureFlag('languageSwitcher');

  return (
    <Box
      data-testid="bottom-bar-main-container"
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        width: '100%',
        height: theme => theme.footer.height,
      }}
    >
      <Box
        data-testid="bottom-bar-left-container"
        sx={{display: 'flex', alignItems: 'center', gap: 1}}
      >
        <TagSearch />
        <TextEntrySearchField />
      </Box>
      <Box
        data-testid="bottom-bar-right-container"
        sx={{display: 'flex', alignItems: 'flex-end', gap: 1}}
      >
        {showLanguageSwitcher && <LanguageSwitcher />}
        <Mode />
        {showHud && <HudMenu />}
      </Box>
    </Box>
  );
};

const memoizedBottomBar = React.memo(BottomBar);

export {memoizedBottomBar as BottomBar};
