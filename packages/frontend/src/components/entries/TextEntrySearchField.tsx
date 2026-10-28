import React, {useCallback, useEffect} from 'react';

import {useAppConfig} from '../../lib/state/appState';
import {StyledTextFieldEntries} from './StyledTextFieldTextEntries';

const TextEntrySearchField = () => {
  const appConfig = useAppConfig();

  const escFunction = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      handleClear();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    appConfig.setEntrySearchString(event.currentTarget.value);
  };

  const handleClear = () => {
    appConfig.setEntrySearchString('');
  };

  return (
    <StyledTextFieldEntries
      value={appConfig.entrySearchString}
      id="textEntrySearch"
      onChange={handleChange}
    />
  );
};

const memoizedTextEntrySearchField = React.memo(TextEntrySearchField);

export {memoizedTextEntrySearchField as TextEntrySearchField};
