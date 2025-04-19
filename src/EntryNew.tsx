import {Box} from '@mui/material';
import {Button} from '@mui/material';
import type {AxiosResponse} from 'axios';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useParams} from 'react-router-dom';

import {activeEntryEditField, appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import {apiBase} from './lib/api/apiBase';
import type {ITagTextEntryThroughModelJsonApiResponseSingle} from './lib/tag_text_entry_through_models';
import type {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import InputEntryBody from './styled/text_entries/InputEntryBody';
import InputEntrySubject from './styled/text_entries/InputEntrySubject';

export interface IEntryNewProps {
  filterAndSortParent: () => void;
  id: string;
}

const EntryNew = ({filterAndSortParent, id}: IEntryNewProps) => {
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
    const text_entry_payload = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject: subject,
          body: body,
        },
      },
    };

    const userObject = appConfig.usersArray.find(
      element => element.attributes.username === user
    );

    const tagObject = appConfig.tagsArray.find(
      element =>
        element.attributes.name === tag &&
        element.relationships.user.data.id === userObject?.id
    );

    apiBase
      .post('/entries', text_entry_payload, {withCredentials: true})
      .then((response: AxiosResponse<ITextEntryJsonApiResponseSingle>) => {
        appConfig.updateOrCreateTextEntry(response.data.data);
        const text_entry_through_model_payload = {
          data: {
            type: 'TagTextEntryThroughModel',
            attributes: {},
            relationships: {
              tag: {
                data: {
                  type: 'Tag',
                  id: tagObject?.id,
                },
              },
              text_entry: {
                data: {
                  type: 'TextEntry',
                  id: response.data.data.id,
                },
              },
            },
          },
        };
        apiBase
          .post('/tags_entries', text_entry_through_model_payload, {
            withCredentials: true,
          })
          .then(
            (
              response: AxiosResponse<ITagTextEntryThroughModelJsonApiResponseSingle>
            ) => {
              console.info(response.data.data);
              appConfig.updateOrCreateTagTextEntryThroughModel(
                response.data.data
              );
              filterAndSortParent();
              appConfig.setEntryNew(null);
            }
          );
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
          marginRight: '2px',
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
        color="secondary"
        size="small"
        variant="outlined"
        onClick={() => {
          handleCancel();
        }}
        sx={{
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

const memoizedEntryNew = React.memo(observer(EntryNew));
export {memoizedEntryNew as EntryNew};
