import React from 'react';

import {useDocumentKeydown} from '../../hooks/useDocumentKeydown';
import {useAppConfig} from '../../lib/state/appState';
import {StyledTextFieldEntries} from './StyledTextFieldTextEntries';

const TextEntrySearchField = () => {
  const appConfig = useAppConfig();

  useDocumentKeydown(event => {
    if (event.code === 'Escape') {
      appConfig.setEntrySearchString('');
    }
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    appConfig.setEntrySearchString(event.currentTarget.value);
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
