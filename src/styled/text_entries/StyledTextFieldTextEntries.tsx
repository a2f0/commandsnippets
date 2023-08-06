import React, {useCallback, useEffect} from 'react';
import {TextField} from '@mui/material';
import {activeSearch} from '../../lib/shared';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';

interface IStyledTextFieldProps {
  id: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTextEntries = ({
  id,
  value,
  onChange,
}: IStyledTextFieldProps) => {
  const appConfig = useAppContext();
  const inputRef = React.useRef<HTMLInputElement>();

  useEffect(() => {
    if (appConfig.activeSearch === activeSearch.entries) {
      inputRef.current?.focus();
    }
  }, [appConfig.clickCount, appConfig.activeSearch]);

  const useVisibility = useCallback(() => {
    if (document.visibilityState === 'visible') {
      console.info('the text entry search has become available');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', useVisibility, false);
    return () => {
      document.removeEventListener('visibilitychange', useVisibility, false);
    };
  }, []);

  const setTextInputRef = (element: HTMLInputElement) => {
    inputRef.current = element;
  };

  return (
    <TextField
      autoComplete="off"
      inputRef={setTextInputRef}
      value={value}
      id={id}
      color="secondary"
      onChange={onChange}
      variant="outlined"
      inputProps={{sx: {pl: 0.5, pt: 0.5, pb: 0.5, pr: 0}}}
      sx={{
        ml: 0.5,
        width: 250,
        padding: 0,
      }}
    />
  );
};

export default React.memo(observer(StyledTextFieldTextEntries));
