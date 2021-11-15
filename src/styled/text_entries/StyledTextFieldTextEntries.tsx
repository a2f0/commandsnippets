import React, {useCallback, useEffect} from 'react';
import TextField from '@mui/material/TextField';
import {Theme} from '@mui/material/styles';
import {autorun} from 'mobx';
import createStyles from '@mui/styles/createStyles';
import makeStyles from '@mui/styles/makeStyles';
import {useAppContext} from '../../AppContext';
import {useTheme} from '@mui/styles';

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
  const theme = useTheme<Theme>();
  const appConfig = useAppContext();
  const useStyles = makeStyles(() =>
    createStyles({
      textField: {
        fontSize: 13,
        marginLeft: `${20}px`,
      },
      root: {
        height: 30,
        width: 250,
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

  useEffect(
    () =>
      autorun(() => {
        if (appConfig.tagsOrEntries === 'entries') {
          inputRef.current?.focus();
        }
      }),
    [appConfig.tagsOrEntries]
  );

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

export default React.memo(StyledTextFieldTextEntries);
