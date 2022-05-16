import React, {useCallback, useEffect} from 'react';
import {activeSearch, keyCode} from '../../lib/shared';
import TextField from '@mui/material/TextField';
import {Theme} from '@mui/material/styles';
import {appMode} from '../../lib/shared';
import createStyles from '@mui/styles/createStyles';
import makeStyles from '@mui/styles/makeStyles';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';
import {useTheme} from '@mui/styles';

interface IStyledTextFieldProps {
  id: string;
  value: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const StyledTextFieldTags = React.forwardRef<
  HTMLInputElement,
  IStyledTextFieldProps
>(({id, value, onChange}: IStyledTextFieldProps, ref) => {
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

  const keyListener = useCallback((event: KeyboardEvent) => {
    const trappedModes = [appMode.tagsList, appMode.entriesList];
    const trappedKeys = ['Tab', 'ArrowLeft', 'ArrowRight'];

    if (event.code === 'Escape') {
      appConfig.setActiveSearch(activeSearch.tags);
    }

    if (trappedModes.includes(appConfig.appMode)) {
      if (event.keyCode === keyCode.Tab) {
        if (appConfig.appMode === appMode.tagsList) {
          appConfig.setAppMode(appMode.entriesList);
          appConfig.setActiveSearch(activeSearch.entries);
        } else if (appConfig.appMode === appMode.entriesList) {
          appConfig.setAppMode(appMode.tagsList);
          appConfig.setActiveSearch(activeSearch.tags);
        }
      } else if (event.keyCode === keyCode.LeftArrow) {
        if (appConfig.appMode === appMode.entriesList) {
          appConfig.setAppMode(appMode.tagsList);
          appConfig.setActiveSearch(activeSearch.tags);
        }
      } else if (event.keyCode === keyCode.RightArrow) {
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
});

StyledTextFieldTags.displayName = 'StyledTextFieldTags';
export default React.memo(observer(StyledTextFieldTags));
