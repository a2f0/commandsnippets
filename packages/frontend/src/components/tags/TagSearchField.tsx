import React, {useCallback, useEffect, useState} from 'react';
import {activeSearch, appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {StyledTextFieldTags} from './StyledTextFieldTags';

const TagSearchField = () => {
  const [tagSearch, setTagSearch] = useState<string>('');
  const appConfig = useAppConfig();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const escFunction = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      appConfig.setAppMode(appMode.tagsList);
      inputRef.current?.focus();
      handleClear();
    }
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagSearch(event.currentTarget.value);
    appConfig.setTagSearchString(event.currentTarget.value);
  };

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);
    document.addEventListener('visibilitychange', useVisibility, false);
    document.addEventListener('focus', useWindowFocus, false);
    return () => {
      document.addEventListener('keydown', escFunction, false);
      document.removeEventListener('visibilitychange', useVisibility, false);
      document.removeEventListener('focus', useWindowFocus, false);
    };
  }, []);

  // Fires when switching tabs (Brave 1.42.88)
  const useVisibility = useCallback(() => {
    console.info('useVisibility');
    if (document.visibilityState === 'visible') {
      if (
        appConfig.appMode !== appMode.entryEditor &&
        appConfig.appMode !== appMode.tagEditor
      ) {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(0, inputRef.current?.value.length);
      }
    }
  }, []);

  const useWindowFocus = useCallback(() => {
    console.info('useWindowFocus');
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(0, inputRef.current?.value.length);
  }, []);

  const setTextInputRef = (element: HTMLInputElement) => {
    inputRef.current = element;
  };

  useEffect(() => {
    if (appConfig.activeSearch === activeSearch.tags) {
      inputRef.current?.focus();
    }
  }, [appConfig.activeSearch]);

  const handleClear = () => {
    setTagSearch('');
    appConfig.setTagSearchString('');
  };

  return (
    <StyledTextFieldTags
      ref={setTextInputRef}
      value={tagSearch}
      id="tagSearch"
      onChange={handleChange}
    />
  );
};

const memoizedTagSearchField = React.memo(TagSearchField);

export {memoizedTagSearchField as TagSearchField};
