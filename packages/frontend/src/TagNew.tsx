import Grid from '@mui/material/Grid';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useAppContext} from './AppContext';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {activeTagEditField, appMode} from './lib/shared';
import {StyledTagButton} from './styled/tags/StyledTagButton';
import {StyledTagFormContainer} from './styled/tags/StyledTagFormContainer';
import {StyledTextFieldTags} from './styled/tags/StyledTextFieldTags';

interface IProps {
  handleNewParent: () => void;
  id: string;
}

const TagNew = ({handleNewParent, id}: IProps) => {
  const [tagName, setTagName] = useState<string>('');
  const appConfig = useAppContext();
  const inputSaveRef = useRef<HTMLButtonElement>(null);
  const inputCancelRef = useRef<HTMLButtonElement>(null);
  const inputTagNameRef = React.useRef<HTMLInputElement>(null);

  const setInputTagNameRef = (element: HTMLInputElement) => {
    inputTagNameRef.current = element;
  };

  const escFunction = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      handleCancel();
    }
  }, []);

  useEffect(() => {
    if (appConfig.activeTagEditField === activeTagEditField.save) {
      inputSaveRef.current?.focus();
    } else if (appConfig.activeTagEditField === activeTagEditField.cancel) {
      inputCancelRef.current?.focus();
    }
  }, [appConfig.activeTagEditField]);

  useEffect(() => {
    if (appConfig.activeTagEditField === activeTagEditField.name) {
      inputTagNameRef.current?.focus();
    }
    return () => {
      appConfig.setActiveTagEditField(activeTagEditField.name);
    };
  }, [appConfig.activeTagEditField, appConfig.setActiveTagEditField]);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, [escFunction]);

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.currentTarget.value);
  };

  const handleCancel = () => {
    setTagName('');
    appConfig.setTagNew(null);
  };

  const handleSave = () => {
    tearleadsApi
      .createTag(tagName)
      .then(response => {
        appConfig.reconcileCollection(response.included);
        appConfig.updateOrCreateTag(response.data);
        handleNewParent();
        appConfig.setTagNew(null);
      })
      .catch((error: unknown) => {
        console.error('Failed to create tag:', error);
      });
  };

  const keyListener = useCallback(
    (event: KeyboardEvent) => {
      const trappedKeyCodes = ['Tab'];
      if (
        trappedKeyCodes.includes(event.code) &&
        appConfig.appMode === appMode.tagEditor
      ) {
        if (appConfig.activeTagEditField === activeTagEditField.name) {
          appConfig.setActiveTagEditField(activeTagEditField.save);
        } else if (appConfig.activeTagEditField === activeTagEditField.save) {
          appConfig.setActiveTagEditField(activeTagEditField.cancel);
        } else if (appConfig.activeTagEditField === activeTagEditField.cancel) {
          appConfig.setActiveTagEditField(activeTagEditField.name);
          inputTagNameRef.current?.focus();
        }
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [
      appConfig.activeTagEditField,
      appConfig.setActiveTagEditField,
      appConfig.appMode,
    ]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);
    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

  return (
    <StyledTagFormContainer id={id}>
      <StyledTextFieldTags
        ref={setInputTagNameRef}
        value={tagName}
        id={`${id}TextField`}
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
      <Grid container spacing={0}>
        <Grid sx={{paddingRight: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            ref={inputSaveRef}
            id={`${id}Save`}
            onClick={() => {
              handleSave();
            }}
          >
            Save
          </StyledTagButton>
        </Grid>
        <Grid sx={{paddingLeft: '1px'}} size={{xs: 6}}>
          <StyledTagButton
            ref={inputCancelRef}
            id={`${id}Cancel`}
            onClick={() => {
              handleCancel();
            }}
          >
            Cancel
          </StyledTagButton>
        </Grid>
      </Grid>
    </StyledTagFormContainer>
  );
};

const memoizedTagNew = React.memo(observer(TagNew));

export {memoizedTagNew as TagNew};
