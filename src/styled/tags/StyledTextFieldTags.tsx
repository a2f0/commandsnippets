import React, {useCallback, useEffect} from 'react';
import TextField from '@mui/material/TextField';
import {Theme} from '@mui/material/styles';
import createStyles from '@mui/styles/createStyles';
import {keyCode} from '../../lib/shared';
import makeStyles from '@mui/styles/makeStyles';
import {useAppContext} from '../../AppContext';
import {useTheme} from '@mui/styles';

interface IStyledTextFieldProps {
  id: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTags = ({id, value, onChange}: IStyledTextFieldProps) => {
  const theme = useTheme<Theme>();
  const appConfig = useAppContext();
  const useStyles = makeStyles(() =>
    createStyles({
      textField: {
        fontSize: 13,
      },
      root: {
        height: 30,
        fontSize: 14,
        '&.Mui-focused': {
          border: `2px solid ${theme.palette.secondary.main}`,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
        },
        background: theme.textInput.background,
      },
      noPadding: {
        paddingLeft: 5,
        paddingTop: 0,
        paddingBottom: 0,
        paddingRight: 0,
      },
    })
  );
  const classes = useStyles();
  const inputRef = React.useRef<HTMLInputElement>();

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef.current]);

  const useVisibility = useCallback(() => {
    if (document.visibilityState === 'visible') {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(0, inputRef.current?.value.length);
    }
  }, []);

  const useWindowFocus = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(0, inputRef.current?.value.length);
  }, []);

  const keyListener = useCallback(event => {
    const trappedKeyCodes = [keyCode.Tab];
    if (event.keyCode === keyCode.Tab) {
      if (appConfig.tagsOrEntries === 'tags') {
        appConfig.setTagsOrEntries('entries');
      } else {
        appConfig.setTagsOrEntries('tags');
        inputRef.current?.focus();
      }
    }
    if (trappedKeyCodes.includes(event.keyCode)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', useVisibility, false);
    window.addEventListener('focus', useWindowFocus, false);
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('visibilitychange', useVisibility, false);
      window.removeEventListener('focus', useWindowFocus, false);
      document.removeEventListener('keydown', keyListener, false);
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
      className={`${classes.textField}`}
      id={id}
      onChange={onChange}
      variant="outlined"
      inputProps={{className: classes.noPadding}}
      InputProps={{
        className: classes.root,
      }}
    />
  );
};

export default React.memo(StyledTextFieldTags);
