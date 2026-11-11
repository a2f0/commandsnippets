import {TextField} from '@mui/material';
import React from 'react';
import {useDocumentKeydown} from '../../hooks/useDocumentKeydown';
import {activeSearch, appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {outlinedFieldSx} from '../../theme/sx';

interface IStyledTextFieldProps {
  id: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** The keys that move the keyboard between the tag and entry lists. */
const PANE_KEYS = ['Tab', 'ArrowLeft', 'ArrowRight'];

/**
 * The list the key moves the keyboard to from `mode`: Tab to the other,
 * ArrowRight from the tags to the entries, ArrowLeft back; or none.
 */
function paneAfter(key: string, mode: appMode) {
  if (mode === appMode.tagsList && (key === 'Tab' || key === 'ArrowRight')) {
    return {mode: appMode.entriesList, search: activeSearch.entries};
  }
  if (mode === appMode.entriesList && (key === 'Tab' || key === 'ArrowLeft')) {
    return {mode: appMode.tagsList, search: activeSearch.tags};
  }
  return null;
}

const StyledTextFieldTags = React.forwardRef<
  HTMLInputElement,
  IStyledTextFieldProps
>(({id, value, onChange}: IStyledTextFieldProps, ref) => {
  const appConfig = useAppConfig();
  useDocumentKeydown(event => {
    if (event.defaultPrevented) return;
    if (event.code === 'Escape') {
      appConfig.setActiveSearch(activeSearch.tags);
    }
    const mode = appConfig.appMode;
    if (mode !== appMode.tagsList && mode !== appMode.entriesList) {
      return;
    }
    const next = paneAfter(event.key, mode);
    if (next !== null) {
      appConfig.setAppMode(next.mode);
      appConfig.setActiveSearch(next.search);
    }
    if (PANE_KEYS.includes(event.code)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  return (
    <TextField
      autoComplete="off"
      inputRef={ref}
      value={value}
      id={id}
      onChange={onChange}
      variant="outlined"
      slotProps={{htmlInput: {sx: {pl: 0.5, pt: 0.5, pb: 0.5, pr: 0}}}}
      sx={{p: 0, ...outlinedFieldSx}}
    />
  );
});

StyledTextFieldTags.displayName = 'StyledTextFieldTags';

const memoizedStyledTextFieldTags = React.memo(StyledTextFieldTags);

export {memoizedStyledTextFieldTags as StyledTextFieldTags};
