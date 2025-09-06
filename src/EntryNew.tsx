import {Box, Button} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useParams} from 'react-router-dom';
import {activeEntryEditField, appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import {useTypedTranslation} from './i18n/hooks';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {InputEntryBody} from './styled/text_entries/InputEntryBody';
import {InputEntrySubject} from './styled/text_entries/InputEntrySubject';
import {commonButtonSx} from './styles/buttons';

export interface IEntryNewProps {
  filterAndSortParent: () => void;
  id: string;
}

const EntryNew = ({filterAndSortParent, id}: IEntryNewProps) => {
  const {t} = useTypedTranslation('common');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const appConfig = useAppContext();
  const {user, tag} = useParams();

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
    const userObject = appConfig.usersArray.find(
      element => element.attributes.username === user
    );

    const tagObject = appConfig.tagsArray.find(
      element =>
        element.attributes.name === tag &&
        element.relationships.user.data.id === userObject?.id
    );

    if (!userObject?.id || !tagObject?.id) {
      console.error('Missing user or tag for entry creation');
      return;
    }

    tearleadsApi
      .createEntry(subject, body, userObject.id)
      .then(response => {
        appConfig.updateOrCreateTextEntry(response.data);

        return tearleadsApi.tagEntry(tagObject.id, response.data.id);
      })
      .then(response => {
        console.info(response.data);
        appConfig.updateOrCreateTagTextEntryThroughModel(response.data);
        filterAndSortParent();
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

const memoizedEntryNew = React.memo(observer(EntryNew));
export {memoizedEntryNew as EntryNew};
