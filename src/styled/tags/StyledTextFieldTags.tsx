import React, {useCallback, useEffect} from 'react';
import {TextField} from '@mui/material';
import {activeSearch} from '../../lib/shared';
import {appMode} from '../../lib/shared';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';

interface IStyledTextFieldProps {
  id: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTags = React.forwardRef<
  HTMLInputElement,
  IStyledTextFieldProps
>(({id, value, onChange}: IStyledTextFieldProps, ref) => {
  const appConfig = useAppContext();
  const keyListener = useCallback((event: KeyboardEvent) => {
    const trappedModes = [appMode.tagsList, appMode.entriesList];
    const trappedKeys = ['Tab', 'ArrowLeft', 'ArrowRight'];

    if (event.code === 'Escape') {
      appConfig.setActiveSearch(activeSearch.tags);
    }

    if (trappedModes.includes(appConfig.appMode)) {
      if (event.key === 'Tab') {
        if (appConfig.appMode === appMode.tagsList) {
          appConfig.setAppMode(appMode.entriesList);
          appConfig.setActiveSearch(activeSearch.entries);
        } else if (appConfig.appMode === appMode.entriesList) {
          appConfig.setAppMode(appMode.tagsList);
          appConfig.setActiveSearch(activeSearch.tags);
        }
      } else if (event.key === 'ArrowLeft') {
        if (appConfig.appMode === appMode.entriesList) {
          appConfig.setAppMode(appMode.tagsList);
          appConfig.setActiveSearch(activeSearch.tags);
        }
      } else if (event.key === 'ArrowRight') {
        if (appConfig.appMode === appMode.tagsList) {
          appConfig.setAppMode(appMode.entriesList);
          appConfig.setActiveSearch(activeSearch.entries);
        }
      }
      if (trappedKeys.includes(event.code)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, []);

  return (
    <TextField
      autoComplete="off"
      inputRef={ref}
      value={value}
      id={id}
      color="secondary"
      onChange={onChange}
      variant="outlined"
      inputProps={{sx: {pl: 0.5, pt: 0.5, pb: 0.5, pr: 0}}}
      sx={{
        p: 0,
      }}
    />
  );
});

StyledTextFieldTags.displayName = 'StyledTextFieldTags';
export default React.memo(observer(StyledTextFieldTags));
