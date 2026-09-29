import {TextField} from '@mui/material';
import React, {useCallback, useEffect} from 'react';
import {activeSearch, appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';

interface IStyledTextFieldProps {
  id: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTags = React.forwardRef<
  HTMLInputElement,
  IStyledTextFieldProps
>(({id, value, onChange}: IStyledTextFieldProps, ref) => {
  const appConfig = useAppConfig();
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
      onChange={onChange}
      variant="outlined"
      slotProps={{htmlInput: {sx: {pl: 0.5, pt: 0.5, pb: 0.5, pr: 0}}}}
      sx={{
        p: 0,
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: theme => theme.palette.text.secondary,
          },
          '&:hover fieldset': {
            borderColor: theme => theme.palette.text.primary,
          },
          '&.Mui-focused fieldset': {
            borderColor: theme => theme.palette.text.primary,
          },
        },
      }}
    />
  );
});

StyledTextFieldTags.displayName = 'StyledTextFieldTags';

const memoizedStyledTextFieldTags = React.memo(StyledTextFieldTags);

export {memoizedStyledTextFieldTags as StyledTextFieldTags};
