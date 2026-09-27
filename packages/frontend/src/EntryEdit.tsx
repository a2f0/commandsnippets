import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {useTheme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {activeEntryEditField, appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import {useTypedTranslation} from './i18n/hooks';
import type {ITextEntryJsonApiResponseSingle} from './lib/api/responses/types';
import {tearleadsApi} from './lib/api/tearleadsApi';
import type {ITextEntryJsonApi} from './lib/store/models/TextEntryModel';
import {needsScrollingIntoView} from './lib/text_entries';
import {InputEntryBody} from './styled/text_entries/InputEntryBody';
import {InputEntrySubject} from './styled/text_entries/InputEntrySubject';
import {commonButtonSx} from './styles/buttons';

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
  const {t} = useTypedTranslation('common');
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
    tearleadsApi
      .updateEntry(object.id, subject, body)
      .then(response => {
        handleSaveParent(response);
      })
      .catch((error: unknown) => {
        console.error('Failed to update entry:', error);
      });
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

  const buttonSx = {
    scrollMarginBottom: '10px',
    marginBottom: '10px',
    ...commonButtonSx,
  };

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
          ...buttonSx,
          marginRight: '2px',
        }}
        size="small"
        variant="outlined"
        onClick={() => {
          handleSave();
        }}
      >
        {t('save')}
      </Button>
      <Button
        ref={setInputCancelRef}
        id={`${id}Cancel`}
        size="small"
        variant="outlined"
        onClick={() => {
          handleCancel();
        }}
        sx={buttonSx}
      >
        {t('cancel')}
      </Button>
    </Box>
  );
};

const memoizedEntryEdit = React.memo(observer(EntryEdit));

export {memoizedEntryEdit as EntryEdit};
