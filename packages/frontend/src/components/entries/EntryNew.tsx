import {Box, Button} from '@mui/material';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {useSession} from '../../lib/data/hooks';
import {createEntry} from '../../lib/data/writes';
import {activeEntryEditField, appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {commonButtonSx} from '../../theme/sx';
import {InputEntryBody} from './InputEntryBody';
import {InputEntrySubject} from './InputEntrySubject';

export interface IEntryNewProps {
  id: string;
  /** The tag the entry goes in (none: untagged). */
  tagId: string | undefined;
}

const EntryNew = ({id, tagId}: IEntryNewProps) => {
  const {t} = useTypedTranslation('common');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const appConfig = useAppConfig();
  const session = useSession();

  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);

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

  const handleSave = () => {
    if (session === null) {
      return;
    }
    createEntry(session, subject, body, tagId)
      .then(() => {
        appConfig.setEntryNew(null);
      })
      .catch((error: unknown) => {
        console.error('Failed to create entry:', error);
      });
  };

  const handleCancel = () => {
    setBody(body);
    setSubject(subject);
    appConfig.setEntryNew(null);
  };

  const handleSubjectChange = useCallback((value: string) => {
    // this will return the same function between re-renders.
    // It causes the subject to not get refocused when updating the body.
    setSubject(value);
  }, []);

  const handleBodyChange = useCallback((value: string) => {
    // this will return the same function between re-renders.
    // It causes the subject to not get refocused when updating the body.
    setBody(value);
  }, []);

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

  const buttonSx = commonButtonSx;

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
        color="secondary"
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
        color="secondary"
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

const memoizedEntryNew = React.memo(EntryNew);

export {memoizedEntryNew as EntryNew};
