import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {useTheme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {activeEntryEditField, appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import type {ApiResponse} from './lib/api/fetchBase';
import {apiBase} from './lib/api/fetchBase';
import type {ITextEntryJsonApi} from './lib/store/models/TextEntryModel';
import type {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import {needsScrollingIntoView} from './lib/text_entries';
import {InputEntryBody} from './styled/text_entries/InputEntryBody';
import {InputEntrySubject} from './styled/text_entries/InputEntrySubject';

export interface IEntryEdit {
  object: ITextEntryJsonApi;
  handleSaveParent: (object: ITextEntryJsonApiResponseSingle) => void;
  handleCancelEditParent: () => void;
  id: string;
}

const EntryEdit = ({
  object,
  handleSaveParent,
  handleCancelEditParent,
  id,
}: IEntryEdit) => {
  const saveRef = useRef<HTMLButtonElement>(null);
  const [subject, setSubject] = useState<string>(object.attributes.subject);
  const [body, setBody] = useState<string>(object.attributes.body);
  const appConfig = useAppContext();
  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);
  const theme = useTheme();

  const setInputSaveRef = (element: HTMLButtonElement) => {
    inputSaveRef.current = element;
  };

  const setInputCancelRef = (element: HTMLButtonElement) => {
    inputCancelRef.current = element;
  };

  useEffect(() => {
    return () => {
      appConfig.setActiveEntryEditField(activeEntryEditField.subject);
      appConfig.setAppMode(appMode.entriesList);
    };
  }, [appConfig.setActiveEntryEditField, appConfig.setAppMode]);

  useEffect(() => {
    if (saveRef.current && needsScrollingIntoView(saveRef, theme)) {
      saveRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'end',
      });
    }
  }, [theme]);

  const handleSave = () => {
    const payload = {
      data: {
        id: object.id,
        type: 'TextEntry',
        attributes: {
          subject: subject,
          body: body,
        },
      },
    };
    apiBase
      .patch<ITextEntryJsonApiResponseSingle>(`entries/${object.id}`, payload, {
        withCredentials: true,
      })
      .then((response: ApiResponse<ITextEntryJsonApiResponseSingle>) => {
        handleSaveParent(response.data);
      })
      .catch(error => {
        console.error(error);
      })
      .then(() => {});
  };

  const handleCancel = () => {
    setBody(object.attributes.body);
    setSubject(object.attributes.body);
    handleCancelEditParent();
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
  };

  const handleSubjectChange = (value: string) => {
    setSubject(value);
  };

  const keyListener = useCallback(
    (event: KeyboardEvent) => {
      const trappedKeyCodes = ['Tab'];
      if (
        trappedKeyCodes.includes(event.code) &&
        appConfig.appMode === appMode.entryEditor
      ) {
        if (appConfig.activeEntryEditField === activeEntryEditField.subject) {
          appConfig.setActiveEntryEditField(activeEntryEditField.body);
        } else if (
          appConfig.activeEntryEditField === activeEntryEditField.body
        ) {
          appConfig.setActiveEntryEditField(activeEntryEditField.save);
        } else if (
          appConfig.activeEntryEditField === activeEntryEditField.save
        ) {
          appConfig.setActiveEntryEditField(activeEntryEditField.cancel);
        } else if (
          appConfig.activeEntryEditField === activeEntryEditField.cancel
        ) {
          appConfig.setActiveEntryEditField(activeEntryEditField.subject);
        }
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [
      appConfig.activeEntryEditField,
      appConfig.appMode,
      appConfig.setActiveEntryEditField,
    ]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);
    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

  useEffect(() => {
    if (appConfig.activeEntryEditField === activeEntryEditField.save) {
      inputSaveRef.current?.focus();
    } else if (appConfig.activeEntryEditField === activeEntryEditField.cancel) {
      inputCancelRef.current?.focus();
    }
  }, [appConfig.activeEntryEditField]);

  return (
    <Box
      id={id}
      sx={{
        ml: theme => `${theme.main.dragIndicatorWidth}px`,
      }}
    >
      <div>
        <InputEntrySubject
          id={`${id}Subject`}
          placeholder="subject"
          valueParent={subject}
          handleChangeParent={handleSubjectChange}
        />
      </div>
      <div>
        <InputEntryBody
          id={`${id}Body`}
          placeholder="body"
          valueParent={body}
          handleChangeParent={handleBodyChange}
        />
      </div>
      <Button
        ref={setInputSaveRef}
        id={`${id}Save`}
        sx={{
          marginRight: '2px',
          scrollMarginBottom: '10px',
          marginBottom: '10px',
          color: theme => theme.palette.text.primary,
          borderColor: theme => theme.palette.text.secondary,
          '&:hover': {
            borderColor: theme => theme.palette.text.primary,
          },
        }}
        size="small"
        variant="outlined"
        onClick={() => {
          handleSave();
        }}
      >
        Save
      </Button>
      <Button
        ref={setInputCancelRef}
        id={`${id}Cancel`}
        size="small"
        variant="outlined"
        onClick={() => {
          handleCancel();
        }}
        sx={{
          scrollMarginBottom: '10px',
          marginBottom: '10px',
          color: theme => theme.palette.text.primary,
          borderColor: theme => theme.palette.text.secondary,
          '&:hover': {
            borderColor: theme => theme.palette.text.primary,
          },
        }}
      >
        Cancel
      </Button>
    </Box>
  );
};

const memoizedEntryEdit = React.memo(observer(EntryEdit));

export {memoizedEntryEdit as EntryEdit};
